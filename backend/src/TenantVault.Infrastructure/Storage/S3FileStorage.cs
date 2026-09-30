using Amazon;
using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;
using Amazon.S3.Util;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using TenantVault.Application.Exceptions;
using TenantVault.Application.Interfaces;
using TenantVault.Application.Services;

namespace TenantVault.Infrastructure.Storage;

public sealed class S3Options
{
    public const string SectionName = "S3";

    /// <summary>Endpoint the API uses (e.g. <c>http://localstack:4566</c>). Empty = real AWS.</summary>
    public string? ServiceUrl { get; set; }

    /// <summary>Endpoint embedded in presigned URLs, reachable by browsers. Defaults to <see cref="ServiceUrl"/>.</summary>
    public string? PublicServiceUrl { get; set; }

    public string BucketName { get; set; } = "tenantvault";
    public string Region { get; set; } = "us-east-1";
    public string? AccessKey { get; set; }
    public string? SecretKey { get; set; }
    public bool ForcePathStyle { get; set; }
}

public sealed class S3FileStorage : IFileStorage, IDisposable
{
    private readonly S3Options _options;
    private readonly IAmazonS3 _client;
    private readonly IAmazonS3 _presignClient;
    private readonly ILogger<S3FileStorage> _logger;

    public S3FileStorage(IOptions<S3Options> options, ILogger<S3FileStorage> logger)
    {
        _options = options.Value;
        _logger = logger;
        _client = CreateClient(_options.ServiceUrl);
        _presignClient = string.IsNullOrWhiteSpace(_options.PublicServiceUrl)
            ? _client
            : CreateClient(_options.PublicServiceUrl);
    }

    public async Task<string> UploadAsync(Guid tenantId, Guid productId, Stream stream, string contentType, CancellationToken ct)
    {
        // Key and extension come from the server and the validated content type, never from the client filename.
        var key = StorageKeys.BuildProductImageKey(tenantId, productId, contentType);

        await using var buffer = new MemoryStream();
        await CopyWithLimitAsync(stream, buffer, ProductService.MaxImageBytes, ct);
        EnsureMagicBytesMatch(buffer, contentType);
        buffer.Position = 0;

        await _client.PutObjectAsync(new PutObjectRequest
        {
            BucketName = _options.BucketName,
            Key = key,
            InputStream = buffer,
            ContentType = contentType,
            ServerSideEncryptionMethod = ServerSideEncryptionMethod.AES256,
            AutoCloseStream = false,
        }, ct);

        _logger.LogInformation("Uploaded object {Key} ({Bytes} bytes)", key, buffer.Length);
        return key;
    }

    public Task<string> GetPresignedUrlAsync(Guid tenantId, string key, TimeSpan ttl, CancellationToken ct)
    {
        StorageKeys.EnsureBelongsToTenant(tenantId, key);

        var request = new GetPreSignedUrlRequest
        {
            BucketName = _options.BucketName,
            Key = key,
            Verb = HttpVerb.GET,
            Expires = DateTime.UtcNow.Add(ttl),
            Protocol = (_options.PublicServiceUrl ?? _options.ServiceUrl)?.StartsWith("http://", StringComparison.OrdinalIgnoreCase) == true
                ? Protocol.HTTP
                : Protocol.HTTPS,
        };

        return Task.FromResult(_presignClient.GetPreSignedURL(request));
    }

    public async Task DeleteAsync(Guid tenantId, string key, CancellationToken ct)
    {
        StorageKeys.EnsureBelongsToTenant(tenantId, key);
        try
        {
            await _client.DeleteObjectAsync(_options.BucketName, key, ct);
        }
        catch (AmazonS3Exception ex)
        {
            // An orphaned object is preferable to failing the user's delete; it stays private either way.
            _logger.LogWarning(ex, "Failed to delete object {Key}", key);
        }
    }

    /// <summary>Creates the bucket if missing, blocks all public access and enables SSE-S3 by default.</summary>
    public async Task EnsureBucketAsync(CancellationToken ct)
    {
        var bucket = _options.BucketName;
        if (!await AmazonS3Util.DoesS3BucketExistV2Async(_client, bucket))
        {
            await _client.PutBucketAsync(new PutBucketRequest { BucketName = bucket, UseClientRegion = true }, ct);
            _logger.LogInformation("Created S3 bucket {Bucket}", bucket);
        }

        await _client.PutPublicAccessBlockAsync(new PutPublicAccessBlockRequest
        {
            BucketName = bucket,
            PublicAccessBlockConfiguration = new PublicAccessBlockConfiguration
            {
                BlockPublicAcls = true,
                BlockPublicPolicy = true,
                IgnorePublicAcls = true,
                RestrictPublicBuckets = true,
            },
        }, ct);

        await _client.PutBucketEncryptionAsync(new PutBucketEncryptionRequest
        {
            BucketName = bucket,
            ServerSideEncryptionConfiguration = new ServerSideEncryptionConfiguration
            {
                ServerSideEncryptionRules =
                [
                    new ServerSideEncryptionRule
                    {
                        ServerSideEncryptionByDefault = new ServerSideEncryptionByDefault
                        {
                            ServerSideEncryptionAlgorithm = ServerSideEncryptionMethod.AES256,
                        },
                    },
                ],
            },
        }, ct);
    }

    public void Dispose()
    {
        _client.Dispose();
        if (!ReferenceEquals(_client, _presignClient)) _presignClient.Dispose();
    }

    private IAmazonS3 CreateClient(string? serviceUrl)
    {
        var config = new AmazonS3Config { ForcePathStyle = _options.ForcePathStyle };
        if (string.IsNullOrWhiteSpace(serviceUrl))
        {
            config.RegionEndpoint = RegionEndpoint.GetBySystemName(_options.Region);
        }
        else
        {
            config.ServiceURL = serviceUrl;
            config.AuthenticationRegion = _options.Region;
        }

        return string.IsNullOrWhiteSpace(_options.AccessKey)
            ? new AmazonS3Client(config)
            : new AmazonS3Client(new BasicAWSCredentials(_options.AccessKey, _options.SecretKey), config);
    }

    private static async Task CopyWithLimitAsync(Stream source, Stream destination, long maxBytes, CancellationToken ct)
    {
        var buffer = new byte[81920];
        long total = 0;
        int read;
        while ((read = await source.ReadAsync(buffer, ct)) > 0)
        {
            total += read;
            if (total > maxBytes)
            {
                throw new BadRequestException("Image must be 5 MB or smaller.", "FILE_TOO_LARGE");
            }

            await destination.WriteAsync(buffer.AsMemory(0, read), ct);
        }

        if (total == 0) throw new BadRequestException("The uploaded file is empty.", "INVALID_FILE");
    }

    // The declared content type must match the file's actual signature.
    private static void EnsureMagicBytesMatch(MemoryStream data, string contentType)
    {
        var bytes = data.GetBuffer().AsSpan(0, (int)Math.Min(data.Length, 12));
        var matches = contentType.ToLowerInvariant() switch
        {
            "image/png" => bytes.Length >= 8 && bytes[..8].SequenceEqual(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }),
            "image/jpeg" => bytes.Length >= 3 && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF,
            "image/webp" => bytes.Length >= 12 && bytes[..4].SequenceEqual("RIFF"u8) && bytes[8..12].SequenceEqual("WEBP"u8),
            _ => false,
        };

        if (!matches)
        {
            throw new BadRequestException("The file content does not match its declared image type.", "INVALID_FILE");
        }
    }
}
