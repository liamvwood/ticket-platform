using Microsoft.EntityFrameworkCore;
using TicketPlatform.Core.Entities;

namespace TicketPlatform.Infrastructure.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Venue> Venues => Set<Venue>();
    public DbSet<Event> Events => Set<Event>();
    public DbSet<TicketType> TicketTypes => Set<TicketType>();
    public DbSet<Ticket> Tickets => Set<Ticket>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<CheckIn> CheckIns => Set<CheckIn>();
    public DbSet<PhoneVerification> PhoneVerifications => Set<PhoneVerification>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<User>(e => {
            e.HasIndex(u => u.Email).IsUnique();
            e.HasIndex(u => u.ReferralCode).IsUnique();
        });

        modelBuilder.Entity<Event>(e =>
            e.HasIndex(ev => ev.Slug).IsUnique());

        modelBuilder.Entity<TicketType>(e =>
            e.Property(t => t.Price).HasColumnType("numeric(10,2)"));

        modelBuilder.Entity<Order>(e => {
            e.Property(o => o.TotalAmount).HasColumnType("numeric(10,2)");
            e.Property(o => o.PlatformFee).HasColumnType("numeric(10,2)");
        });

        modelBuilder.Entity<Payment>(e =>
            e.Property(p => p.Amount).HasColumnType("numeric(10,2)"));

        // Prevent overselling: optimistic concurrency on TicketType via Postgres xmin
        modelBuilder.Entity<TicketType>()
            .Property<uint>("xmin")
            .HasColumnName("xmin")
            .HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate()
            .IsConcurrencyToken();

        modelBuilder.Entity<Ticket>()
            .HasOne(t => t.CheckIn)
            .WithOne(c => c.Ticket)
            .HasForeignKey<CheckIn>(c => c.TicketId);
    }
}
