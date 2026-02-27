using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TicketPlatform.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddOAuthIdentityFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ExternalId",
                table: "Users",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ExternalProvider",
                table: "Users",
                type: "text",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_ExternalProvider_ExternalId",
                table: "Users",
                columns: new[] { "ExternalProvider", "ExternalId" },
                unique: true,
                filter: "\"ExternalProvider\" IS NOT NULL AND \"ExternalId\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Users_ExternalProvider_ExternalId",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "ExternalId",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "ExternalProvider",
                table: "Users");
        }
    }
}
