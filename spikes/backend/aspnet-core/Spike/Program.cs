var overpass = new OverpassClient(
    new HttpClient { Timeout = TimeSpan.FromSeconds(20) },
    Environment.GetEnvironmentVariable("OVERPASS_URL") ?? "https://overpass-api.de/api/interpreter");

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls("http://0.0.0.0:8080");
var app = builder.Build();

app.MapGet("/api/v1/health", () => Results.Json(new { status = "ok" }));

app.MapGet("/api/v1/water", async (string? bbox) =>
{
    if (string.IsNullOrEmpty(bbox)) return Results.BadRequest();
    try { return Results.Content(await overpass.WaterAsync(bbox), "application/json"); }
    catch (InvalidOperationException e) { return Results.Text(e.Message, statusCode: 502); }
});

app.Run();
