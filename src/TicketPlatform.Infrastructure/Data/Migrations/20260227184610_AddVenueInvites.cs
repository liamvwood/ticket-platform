using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TicketPlatform.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddVenueInvites : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "VenueInvites",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Token = table.Column<string>(type: "text", nullable: false),
                    Email = table.Column<string>(type: "text", nullable: false),
                    VenueName = table.Column<string>(type: "text", nullable: false),
                    InvitedById = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UsedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CreatedUserId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VenueInvites", x => x.Id);
                    table.ForeignKey(
                        name: "FK_VenueInvites_Users_InvitedById",
                        column: x => x.InvitedById,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_VenueInvites_InvitedById",
                table: "VenueInvites",
                column: "InvitedById");

            migrationBuilder.CreateIndex(
                name: "IX_VenueInvites_Token",
                table: "VenueInvites",
                column: "Token",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "VenueInvites");
        }
    }
}
