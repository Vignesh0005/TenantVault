# Build context: the backend root (see docker-compose.yml), so every project is available.
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY Directory.Build.props ./
COPY src/TenantVault.Domain/TenantVault.Domain.csproj src/TenantVault.Domain/
COPY src/TenantVault.Application/TenantVault.Application.csproj src/TenantVault.Application/
COPY src/TenantVault.Infrastructure/TenantVault.Infrastructure.csproj src/TenantVault.Infrastructure/
COPY src/TenantVault.Api/TenantVault.Api.csproj src/TenantVault.Api/
RUN dotnet restore src/TenantVault.Api/TenantVault.Api.csproj

COPY src/ src/
RUN dotnet publish src/TenantVault.Api/TenantVault.Api.csproj -c Release -o /app/publish --no-restore /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
COPY --from=build /app/publish .
USER app
ENTRYPOINT ["dotnet", "TenantVault.Api.dll"]
