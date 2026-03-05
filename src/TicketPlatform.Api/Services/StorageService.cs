using Amazon.S3;
using Amazon.S3.Model;

namespace TicketPlatform.Api.Services;

public interface IStorageService
{
    Task<string> UploadEventThumbnailAsync(Guid eventId, Stream stream, string contentType);

    /// <summary>
    /// Generates a presigned S3 PUT URL that lets clients upload directly to S3.
    /// The object is stored at originals/{imageId}.jpg.
    /// </summary>
    Task<PresignedUploadResult> GeneratePresignedUploadUrlAsync(Guid imageId);
}

public sealed record PresignedUploadResult(string UploadUrl, string ImageId, string? CdnImageUrl);

/// <summary>
/// Stores event thumbnails in S3. Falls back to a data-URL in Development
/// when Aws:BucketName is not configured (no real bucket required for local dev).
/// </summary>
public sealed class S3StorageService(IConfiguration config, ILogger<S3StorageService> logger) : IStorageService
{
    private readonly string? _bucket = config["Aws:BucketName"];
    private readonly string? _imageBucket = config["Aws:ImageBucket"];
    private readonly string _region = config["Aws:Region"] ?? "us-east-1";
    private readonly string? _cdnDomain = config["Aws:CdnDomain"];

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

    public Task<PresignedUploadResult> GeneratePresignedUploadUrlAsync(Guid imageId)
    {
        var bucket = _imageBucket ?? _bucket;
        if (string.IsNullOrWhiteSpace(bucket))
        {
            // Dev fallback — return a placeholder so the API doesn't crash locally
            logger.LogWarning("Aws:ImageBucket not configured — returning placeholder presigned URL.");
            var placeholder = new PresignedUploadResult(
                UploadUrl: $"http://localhost/dev-placeholder/originals/{imageId}.jpg",
                ImageId: imageId.ToString(),
                CdnImageUrl: null);
            return Task.FromResult(placeholder);
        }

        var key = $"originals/{imageId}.jpg";
        var s3 = new AmazonS3Client(Amazon.RegionEndpoint.GetBySystemName(_region));

        var presignRequest = new GetPreSignedUrlRequest
        {
            BucketName = bucket,
            Key = key,
            Verb = HttpVerb.PUT,
            ContentType = "image/jpeg",
            Expires = DateTime.UtcNow.AddMinutes(15),
        };

        var uploadUrl = s3.GetPreSignedURL(presignRequest);

        var cdnImageUrl = !string.IsNullOrWhiteSpace(_cdnDomain)
            ? $"https://{_cdnDomain}/img/1200x630/cover/{imageId}.jpg"
            : null;

        var result = new PresignedUploadResult(
            UploadUrl: uploadUrl,
            ImageId: imageId.ToString(),
            CdnImageUrl: cdnImageUrl);

        return Task.FromResult(result);
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
