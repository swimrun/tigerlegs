# Build: docker build -t spike-aspnet-core .
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY Spike/Spike.csproj Spike/
RUN dotnet restore Spike/Spike.csproj
COPY Spike/ Spike/
RUN dotnet publish Spike/Spike.csproj -c Release -o /out --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /out .
EXPOSE 8080
ENTRYPOINT ["dotnet", "Spike.dll"]
