namespace Vitaloop.Crm.Web.ViewModels;

public sealed class BillingPageViewModel
{
    public string SubscriptionStatus { get; init; } = "free";
    public string CurrentPlan { get; init; } = "personal";
    public DateTimeOffset? NextRenewalAt { get; init; }
    public bool StripeReady { get; init; }
}
