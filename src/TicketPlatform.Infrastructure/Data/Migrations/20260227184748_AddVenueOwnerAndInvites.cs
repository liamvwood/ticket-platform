using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TicketPlatform.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddVenueOwnerAndInvites : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "OwnerId",
                table: "Venues",
                type: "uuid",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "OwnerId",
                table: "Venues");
        }
    }
}
