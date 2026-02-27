FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ["src/TicketPlatform.Api/TicketPlatform.Api.csproj", "src/TicketPlatform.Api/"]
COPY ["src/TicketPlatform.Core/TicketPlatform.Core.csproj", "src/TicketPlatform.Core/"]
COPY ["src/TicketPlatform.Infrastructure/TicketPlatform.Infrastructure.csproj", "src/TicketPlatform.Infrastructure/"]
RUN dotnet restore "src/TicketPlatform.Api/TicketPlatform.Api.csproj"
COPY . .
WORKDIR "/src/src/TicketPlatform.Api"
RUN dotnet build "TicketPlatform.Api.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "TicketPlatform.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "TicketPlatform.Api.dll"]
