using Xunit;
using System.Net;

/// <summary>The exponential backoff of the Overpass client, against a scripted handler and without real waiting.</summary>
public class OverpassClientTests
{
    private sealed class Scripted(params HttpStatusCode[] statuses) : HttpMessageHandler
    {
        public int Calls;
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var status = statuses[Math.Min(Calls++, statuses.Length - 1)];
            return Task.FromResult(new HttpResponseMessage(status) { Content = new StringContent(status == HttpStatusCode.OK ? "{\"elements\":[]}" : "busy") });
        }
    }

    private static (OverpassClient Client, Scripted Handler, List<int> Waits) Client(params HttpStatusCode[] statuses)
    {
        var handler = new Scripted(statuses);
        var waits = new List<int>();
        return (new OverpassClient(new HttpClient(handler), "http://overpass.test/", ms => { waits.Add(ms); return Task.CompletedTask; }), handler, waits);
    }

    [Fact]
    public async Task ABusyServerIsRetriedWithADoublingWaitThenItWorks()
    {
        var (client, handler, waits) = Client(HttpStatusCode.BadGateway, HttpStatusCode.ServiceUnavailable, HttpStatusCode.OK);
        Assert.Equal("{\"elements\":[]}", await client.WaterAsync("1,2,3,4"));
        Assert.Equal([1000, 2000], waits);
        Assert.Equal(3, handler.Calls);
    }

    [Fact]
    public async Task ThreeBusyAnswersEndInAnError()
    {
        var (client, handler, waits) = Client(HttpStatusCode.ServiceUnavailable);
        await Assert.ThrowsAsync<InvalidOperationException>(() => client.WaterAsync("1,2,3,4"));
        Assert.Equal([1000, 2000], waits);
        Assert.Equal(3, handler.Calls);
    }

    [Fact]
    public async Task ABadQueryIsNotRetried()
    {
        var (client, handler, waits) = Client(HttpStatusCode.BadRequest);
        await Assert.ThrowsAsync<InvalidOperationException>(() => client.WaterAsync("1,2,3,4"));
        Assert.Empty(waits);
        Assert.Equal(1, handler.Calls);
    }

    [Fact]
    public async Task AnAnswerOnTheFirstTryNeedsNoWaiting()
    {
        var (client, _, waits) = Client(HttpStatusCode.OK);
        await client.WaterAsync("1,2,3,4");
        Assert.Empty(waits);
    }
}
