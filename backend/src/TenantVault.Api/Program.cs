using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Microsoft.OpenApi.Models;
using Serilog;
using Serilog.Events;
using TenantVault.Api;
using TenantVault.Api.Filters;
using TenantVault.Api.Logging;
using TenantVault.Api.Middleware;
using TenantVault.Api.Services;
using TenantVault.Application;
using TenantVault.Application.Interfaces;
using TenantVault.Application.Services;
using TenantVault.Infrastructure;
using TenantVault.Infrastructure.Persistence;
using TenantVault.Infrastructure.Security;
using TenantVault.Infrastructure.Seeding;
using TenantVault.Infrastructure.Storage;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((context, services, logger) =>
{
    logger
        .MinimumLevel.Information()
        .MinimumLevel.Override("Microsoft.AspNetCore", LogEventLevel.Warning)
        .MinimumLevel.Override("Microsoft.EntityFrameworkCore", LogEventLevel.Warning)
        .Enrich.FromLogContext()
        .Enrich.With(new TenantLogEnricher(services.GetRequiredService<IHttpContextAccessor>()));

    const string template = "[{Timestamp:HH:mm:ss} {Level:u3}] tenant={TenantId} user={UserId} {Message:lj}{NewLine}{Exception}";
    logger.WriteTo.Console(outputTemplate: template);
    if (!context.HostingEnvironment.IsDevelopment())
    {
        logger.WriteTo.File("logs/tenantvault-.log", rollingInterval: RollingInterval.Day, retainedFileCountLimit: 14, outputTemplate: template);
    }
});

// 1
builder.Services
    .AddControllers(options => options.Filters.Add<ValidationFilter>())
    .ConfigureApiBehaviorOptions(options =>
    {
        options.InvalidModelStateResponseFactory = context => new BadRequestObjectResult(new
        {
            error = "Validation failed",
            code = "VALIDATION_FAILED",
            errors = context.ModelState
                .Where(e => e.Value?.Errors.Count > 0)
                .ToDictionary(
                    e => string.IsNullOrEmpty(e.Key) ? "body" : char.ToLowerInvariant(e.Key[0]) + e.Key[1..],
                    e => e.Value!.Errors.Select(x => string.IsNullOrEmpty(x.ErrorMessage) ? "Invalid value" : x.ErrorMessage).ToArray()),
        });
    });

// 2
builder.Services.AddDbContext<AppDbContext>((services, options) =>
    TenantVault.Infrastructure.DependencyInjection.ConfigureTenantVaultDb(
        services,
        options,
        services.GetRequiredService<IConfiguration>().GetConnectionString("Default")
        ?? throw new InvalidOperationException("ConnectionStrings:Default is not configured.")));

// 3-8
builder.Services.AddScoped<ITenantProvider, TenantProvider>();
builder.Services.AddScoped<ICurrentUser, CurrentUser>();
builder.Services.AddScoped<IAuditService, AuditService>();
builder.Services.AddSingleton<IPasswordHasher, BcryptPasswordHasher>();
builder.Services.AddSingleton<ITokenService, JwtTokenService>();
builder.Services.AddSingleton<IFileStorage, S3FileStorage>();

builder.Services.AddHttpContextAccessor();
builder.Services.AddApplication(builder.Configuration);
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.Configure<TenancyOptions>(builder.Configuration.GetSection(TenancyOptions.SectionName));

// 9
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false;
        options.Events = new JwtBearerEvents
        {
            OnChallenge = async context =>
            {
                context.HandleResponse();
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                var reason = context.AuthenticateFailure is null
                    ? "Authentication required"
                    : JwtTokenService.DescribeFailure(context.AuthenticateFailure);
                await context.Response.WriteAsJsonAsync(new { error = reason, code = "UNAUTHENTICATED" });
            },
        };
    });
builder.Services
    .AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
    .Configure<IOptions<JwtOptions>>((options, jwt) =>
        options.TokenValidationParameters = JwtTokenService.CreateValidationParameters(jwt.Value));

// 10
builder.Services.AddAuthorization(options =>
{
    options.FallbackPolicy = new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build();
});

// 11
var allowedOrigins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? ["http://localhost:5173"];
builder.Services.AddCors(options => options.AddPolicy("Frontend", policy => policy
    .WithOrigins(allowedOrigins)
    .WithHeaders("Authorization", "Content-Type", TenancyOptions.HeaderName)
    .WithMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
    .WithExposedHeaders("Content-Disposition", "Retry-After")));

// 12
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo { Title = "TenantVault API", Version = "v1" });

    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        Description = "JWT from POST /auth/login",
    });
    options.AddSecurityDefinition("Tenant", new OpenApiSecurityScheme
    {
        Type = SecuritySchemeType.ApiKey,
        In = ParameterLocation.Header,
        Name = TenancyOptions.HeaderName,
        Description = "Tenant slug or id, e.g. acme-corp",
    });
    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        [new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" } }] = [],
        [new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Tenant" } }] = [],
    });

    var xml = Path.Combine(AppContext.BaseDirectory, "TenantVault.Api.xml");
    if (File.Exists(xml))
    {
        options.IncludeXmlComments(xml);
    }
});

builder.Services.AddTenantVaultRateLimiting();
builder.Services.AddHealthChecks();

var app = builder.Build();

// Refuse to boot if a TenantId-bearing entity escaped the isolation model.
using (var scope = app.Services.CreateScope())
{
    TenantModelValidator.AssertModel(scope.ServiceProvider.GetRequiredService<AppDbContext>().Model);
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseSerilogRequestLogging();
app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseHttpsRedirection();
app.UseCors("Frontend");
app.UseAuthentication();
app.UseRateLimiter();
app.UseMiddleware<TenantMiddleware>();
app.UseAuthorization();
app.MapControllers();
app.MapHealthChecks("/health").AllowAnonymous().DisableRateLimiting();

if (app.Environment.IsDevelopment() || app.Configuration.GetValue<bool>("Seed:Enabled"))
{
    await using var scope = app.Services.CreateAsyncScope();
    await DatabaseSeeder.SeedAsync(scope.ServiceProvider);
}

app.Run();

public partial class Program;
