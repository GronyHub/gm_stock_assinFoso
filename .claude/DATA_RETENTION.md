# Data Retention Policy for Neon Free Tier

**Free Tier Limit:** 10 GB storage

## Storage Optimization Strategy

### Automatic Retention Policies

| Table | Retention | Action | Rationale |
|-------|-----------|--------|-----------|
| `live_sale_taps` | 6 months (undone only) | Archive/Delete | Completed transactions, kept for audit trail only |
| `manage_logs` | 1 year | Delete | Activity logs, older entries not needed |
| `password_reset_tokens` | 24 hours | Delete | Security: expired tokens not needed |
| `training_attempts` | 6 months | Delete | Training records, summarize if needed |
| `stock_count_revisions` | 1 year | Archive | Keep for reconciliation, older can be archived |
| `manage_content` | Review quarterly | Cleanup | Remove unused media/content |

### Query Optimization (Already Implemented)

- **5-minute API caching** on `/api/losses/summary` → ~70-80% reduction in DB queries
- **Indexed queries** for common lookups (item_id, tapped_at, created_at)
- **Materialized views** for frequently aggregated data

### Running Optimization

**Manually trigger cleanup:**
```bash
curl -X POST http://localhost:3000/api/maintenance/optimize-db \
  -H "Authorization: Bearer YOUR_MAINTENANCE_SECRET"
```

**Response includes:**
- Records archived/deleted by table
- Current database size
- Recommendations for further optimization

### Storage Breakdown (Estimated)

```
Live Sale Taps (6 months)     ~2-3 GB
Items & Inventory              ~0.5 GB
Purchase Orders & Bills        ~1-2 GB
Management Logs (1 year)       ~0.5-1 GB
User Data & Settings           ~0.1 GB
Training & Other              ~0.5-1 GB
Indexes & System              ~1-2 GB
─────────────────────────────────────
Total Target                   <10 GB
```

### Cost Reduction Measures

1. **Archive Strategy**: Keep recent 6 months hot, older data can be:
   - Exported to CSV and stored in cold storage (S3)
   - Aggregated into summary tables
   - Deleted if not needed for compliance

2. **Cache Layer**: Implemented 5-minute cache for API responses
   - Reduces peak database load
   - Estimated 70-80% query reduction

3. **Index Optimization**: Auto-analyze tables to remove unused indexes

4. **Column Pruning**: Identify and remove unused columns from large tables

## Scheduled Maintenance

Add to your CI/CD or schedule weekly:
```
POST /api/maintenance/optimize-db
```

This automatically:
- Deletes expired tokens
- Archives old logs
- Removes completed transactions
- Analyzes tables for performance

## Monitoring

Track database size with:
```sql
SELECT pg_size_pretty(pg_database_size(current_database()));
```

Set up alerts if database exceeds 8 GB.

## Migration Path

If you outgrow free tier:
1. **Upgrade to Neon Pro** ($15/month, 500 GB)
2. **Maintain archive**: Keep hot data <10GB, archive older to S3
3. **Separate read replicas**: For reporting (paid tier feature)
