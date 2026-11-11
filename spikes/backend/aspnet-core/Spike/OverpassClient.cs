using System.Net;
using System.Text;

/// <summary>The Overpass water query with exponential backoff (1 s, 2 s) on a busy server.</summary>
public sealed class OverpassClient(HttpClient http, string url, Func<int, Task>? delay = null)
{
    private static readonly HashSet<HttpStatusCode> Retryable =
        [(HttpStatusCode)429, HttpStatusCode.BadGateway, HttpStatusCode.ServiceUnavailable, HttpStatusCode.GatewayTimeout];

    private readonly Func<int, Task> delay = delay ?? (ms => Task.Delay(ms));

    public async Task<string> WaterAsync(string bbox)
    {
        var query = $"[out:json][timeout:25];(way[\"natural\"=\"water\"]({bbox});relation[\"natural\"=\"water\"]({bbox});way[\"waterway\"=\"riverbank\"]({bbox}););out geom;";
        var wait = 1000;
        var last = "no Overpass server reachable";
        for (var attempt = 1; attempt <= 3; attempt++)
        {
            try
            {
                using var content = new StringContent("data=" + Uri.EscapeDataString(query), Encoding.UTF8, "application/x-www-form-urlencoded");
                using var response = await http.PostAsync(url, content);
                if (response.IsSuccessStatusCode) return await response.Content.ReadAsStringAsync();
                last = $"Overpass returned status {(int)response.StatusCode}";
                if (!Retryable.Contains(response.StatusCode)) break;
            }
            catch (HttpRequestException e) { last = e.Message; }
            if (attempt < 3) { await delay(wait); wait *= 2; }
        }
        throw new InvalidOperationException(last);
    }
}
