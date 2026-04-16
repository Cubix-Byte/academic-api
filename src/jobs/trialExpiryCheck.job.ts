import * as tenantRepository from '../repositories/tenant.repository';

const formatLocalDate = (dateUtc: Date, timeZone: string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(dateUtc);

/**
 * Timezone-aware trial decrement job
 * Runs frequently to ensure each tenant loses 1 trial day at their local midnight
 */
export const checkAndUpdateExpiredTrials = async () => {
  try {
    const nowUTC = new Date();
    console.log(`🔍 [CRON] Starting timezone-aware trial check at ${nowUTC.toISOString()}`);

    const result = await tenantRepository.findTenants({
      pageNo: 1,
      pageSize: 1000,
      filters: {
        isTrial: true,
        profileStatus: 'active',
      },
    });

    const tenants = result.tenants || [];
    console.log(`📊 [CRON] Found ${tenants.length} trial tenant(s)`);

    let decrementedCount = 0;
    let expiredCount = 0;

    for (const tenant of tenants) {
      try {
        // Get tenant ID safely
        const tenantId = tenant._id?.toString() || tenant.id?.toString();
        if (!tenantId) {
          console.error(`❌ [CRON] Tenant ${tenant.tenantName} has no valid ID, skipping`);
          continue;
        }

        const tenantTimeZone = tenant.timeZone || 'UTC';
        const localToday = formatLocalDate(nowUTC, tenantTimeZone);

        // Initialize totals if missing (legacy data)
        let trialDaysTotal =
          tenant.trialDaysTotal ?? tenant.trialDaysRemaining ?? 0;
        let trialDaysRemaining =
          tenant.trialDaysRemaining ?? tenant.trialDaysTotal ?? 0;

        // Normalize last decrement date
        let lastDecrementDate =
          typeof tenant.lastTrialDecrementDate === 'string'
            ? tenant.lastTrialDecrementDate
            : null;

        // If we have missing fields, initialize them once and skip decrement this run
        if (lastDecrementDate === null) {
          const initPayload: any = {
            trialDaysTotal,
            trialDaysRemaining,
            lastTrialDecrementDate: localToday,
          };
          await tenantRepository.updateTenant(tenantId, initPayload);
          console.log(
            `🔧 [CRON] Initialized trial tracking for ${tenant.tenantName} - ${trialDaysRemaining} days`
          );
          continue;
        }

        // Decrement only when a new local calendar day has started
        if (localToday > lastDecrementDate && trialDaysRemaining > 0) {
          const updatedRemaining = trialDaysRemaining - 1;

          const updatePayload: any = {
            trialDaysRemaining: updatedRemaining,
            lastTrialDecrementDate: localToday,
          };

          if (updatedRemaining <= 0) {
            updatePayload.isTrial = false;
            updatePayload.profileStatus = 'inactive';
          }

          await tenantRepository.updateTenant(tenantId, updatePayload);

          console.log(
            `📅 [CRON] Decremented trial for ${tenant.tenantName} (${tenantTimeZone}) - ${Math.max(
              0,
              updatedRemaining,
            )} days remaining`
          );

          decrementedCount++;
          if (updatedRemaining <= 0) expiredCount++;
        }
      } catch (tenantError: any) {
        console.error(
          `❌ [CRON] Error processing tenant ${tenant.tenantName}:`,
          tenantError.message
        );
        continue;
      }
    }

    console.log(
      `✅ [CRON] Trial check completed - ${decrementedCount} decremented, ${expiredCount} expired`
    );
    return { checked: tenants.length, decremented: decrementedCount, expired: expiredCount };
  } catch (error: any) {
    console.error('❌ [CRON] Error in trial expiry check:', error);
    throw error;
  }
};
