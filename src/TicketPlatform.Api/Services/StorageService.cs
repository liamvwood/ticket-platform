using Amazon.S3;
using Amazon.S3.Model;

namespace TicketPlatform.Api.Services;

public interface IStorageService
{
    Task<string> UploadEventThumbnailAsync(Guid eventId, Stream stream, string contentType);
}

/// <summary>
/// Stores event thumbnails in S3. Falls back to a data-URL in Development
/// when Aws:BucketName is not configured (no real bucket required for local dev).
/// </summary>
public sealed class S3StorageService(IConfiguration config, ILogger<S3StorageService> logger) : IStorageService
{
    private readonly string? _bucket = config["Aws:BucketName"];
    private readonly string _region = config["Aws:Region"] ?? "us-east-1";

    public async Task<string> UploadEventThumbnailAsync(Guid eventId, Stream stream, string contentType)
    {
        if (string.IsNullOrWhiteSpace(_bucket))
        {
            // Local dev fallback: store as base64 data URL (no S3 account needed)
            logger.LogWarning("Aws:BucketName not configured — storing thumbnail as data URL.");
            using var ms = new MemoryStream();
            await stream.CopyToAsync(ms);
            var b64 = Convert.ToBase64String(ms.ToArray());
            return $"data:{contentType};base64,{b64}";
        }

        var key = $"events/{eventId}/thumbnail{ExtensionFor(contentType)}";

        var s3 = new AmazonS3Client(Amazon.RegionEndpoint.GetBySystemName(_region));
        var req = new PutObjectRequest
        {
            BucketName = _bucket,
            Key = key,
            InputStream = stream,
            ContentType = contentType,
            // Bucket policy handles public reads; CannedACL is incompatible with BucketOwnerEnforced ownership
        };

        await s3.PutObjectAsync(req);

        return $"https://{_bucket}.s3.{_region}.amazonaws.com/{key}";
    }

    private static string ExtensionFor(string contentType) => contentType switch
    {
        "image/jpeg" => ".jpg",
        "image/png"  => ".png",
        "image/webp" => ".webp",
        "image/gif"  => ".gif",
        _            => ".bin",
    };
}
