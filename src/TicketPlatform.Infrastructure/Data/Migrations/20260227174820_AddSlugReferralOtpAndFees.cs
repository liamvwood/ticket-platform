using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TicketPlatform.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddSlugReferralOtpAndFees : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ReferralCode",
                table: "Users",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<decimal>(
                name: "PlatformFee",
                table: "Orders",
                type: "numeric(10,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "ReferredBy",
                table: "Orders",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Slug",
                table: "Events",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "PhoneVerifications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PhoneNumber = table.Column<string>(type: "text", nullable: false),
                    Code = table.Column<string>(type: "text", nullable: false),
                    Attempts = table.Column<int>(type: "integer", nullable: false),
                    Used = table.Column<bool>(type: "boolean", nullable: false),
                    ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PhoneVerifications", x => x.Id);
                });

            // Backfill unique referral codes for any existing users before creating the unique index.
            // Uses Postgres substring(md5(random()::text), 1, 8) to generate an 8-char hex code.
            migrationBuilder.Sql(@"
                UPDATE ""Users""
                SET ""ReferralCode"" = substring(md5(random()::text || ""Id""::text), 1, 8)
                WHERE ""ReferralCode"" = '';
            ");

            // Backfill slugs for existing events using their name + short id
            migrationBuilder.Sql(@"
                UPDATE ""Events""
                SET ""Slug"" = regexp_replace(lower(""Name""), '[^a-z0-9]+', '-', 'g')
                    || '-' || substring(replace(""Id""::text, '-', ''), 1, 8)
                WHERE ""Slug"" = '';
            ");

            migrationBuilder.CreateIndex(
                name: "IX_Users_ReferralCode",
                table: "Users",
                column: "ReferralCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Events_Slug",
                table: "Events",
                column: "Slug",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PhoneVerifications");

            migrationBuilder.DropIndex(
                name: "IX_Users_ReferralCode",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "IX_Events_Slug",
                table: "Events");

            migrationBuilder.DropColumn(
                name: "ReferralCode",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "PlatformFee",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "ReferredBy",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "Slug",
                table: "Events");
        }
    }
}
