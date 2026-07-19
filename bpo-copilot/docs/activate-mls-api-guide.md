# Connect Your MLS to BPO Copilot

**A step-by-step guide to getting MLS API access**

BPO Copilot auto-drafts your broker price opinions by pulling comparable sales directly from your MLS. To do that, it needs read access to your MLS's data feed through the **RESO Web API**. This guide walks you through requesting that access and entering it in the app.

> **Time:** ~15 minutes to request + **1–15 business days** for your MLS to approve. You only do this once.

---

## Before you start

You'll need:

- An **active MLS membership** in good standing (dues paid, no violations).
- The **name of your MLS** (e.g., MetroList, MLSListings, Bright MLS, ACTRIS).
- Your **MLS member / agent ID**.
- In some MLSs, a quick **sign-off from your broker of record** — check step 3.

One thing to know up front: MLS API access is a permission your MLS grants you — it's not a switch you flip yourself instantly. The steps below are how you request it.

---

## Important: ask for the right kind of access

MLSs offer several data programs. For BPOs you specifically need one that **includes Closed / Sold listings**:

| Program | Includes sold data? | Right for BPOs? |
|---|---|---|
| **IDX** (Internet Data Exchange) | Usually **no** | ❌ No |
| **VOW** / back-office / data-feed / "Web API data license" | **Yes** | ✅ Yes |

When you make your request, say plainly: **"I need RESO Web API access that includes Closed/Sold data for property valuation."** If you're only given IDX, comps won't populate.

---

## The fast path: connect through an aggregator (recommended)

Instead of wiring up your MLS directly, most agents connect through a **data aggregator** that already speaks to hundreds of MLSs through one standardized RESO Web API. Pick the one that serves your MLS:

- **MLS Grid** — covers 40+ MLSs, issues a single API token.
- **CoreLogic Trestle** — 250+ MLSs, OAuth2 credentials.
- **Bridge Interactive** (Zillow Group) — server token per dataset.
- **Spark Platform (FBS)** — best if your board runs FlexMLS.

Not sure which serves your MLS? Ask your MLS help desk *"Which RESO Web API provider do you use — MLS Grid, Trestle, Bridge, or Spark?"* or check the app's provider list.

### Steps

1. **Confirm the provider** for your MLS (ask your MLS, as above).
2. **Go to that provider's signup / access-request page** and start a Web API data request.
3. **Name BPO Copilot as your technology provider / approved vendor.** The form will ask what tool will consume the data — enter **BPO Copilot**. (This works because we hold a vendor agreement with the aggregator; if the form doesn't recognize us, contact our support and we'll get added.)
4. **Select the Closed/Sold data scope** (see the box above).
5. **Submit and sign the data license agreement.** This is a standard use agreement covering how the data may be displayed and stored.
6. **Wait for approval** (typically a few days).
7. **Receive your credentials** — usually an API token, or a Client ID + Client Secret, plus a base API URL.

---

## Alternative: direct with your local MLS

If your MLS runs its own RESO Web API (no aggregator), do this instead:

1. **Log in to your MLS member portal** and find the section named **API access**, **Data services**, **Web API**, or **Developer**. (If you can't find it, call the help desk.)
2. **Request RESO Web API access with Closed/Sold data.**
3. **Get broker authorization** if your MLS requires it — some need your broker of record to approve third-party data access.
4. **Name BPO Copilot** as the receiving application/vendor.
5. **Sign the data license agreement** and pay any feed fee (some MLSs charge a small monthly amount).
6. **Receive your credentials:** OData base URL, token URL, and Client ID / Client Secret (or a token).

---

## Enter your credentials in BPO Copilot

Once your credentials arrive:

1. Open **Settings → Data connections → Connect your MLS**.
2. **Choose your provider** (MLS Grid, Trestle, Bridge, Spark, or Direct RESO).
3. If your provider supports it, click **Authorize with OAuth** — you'll log in on their site and won't have to paste any secret.
4. Otherwise, **paste your token or Client ID / Secret**, enter your **MLS name** and **member ID**, and click **Test & connect**.
5. A green **Connected** banner means you're done. You'll see which data scopes are active (Active + Closed should both show).

> 🔒 Your credentials are sent once over an encrypted connection and stored securely on our servers — never in your browser. We never display a secret again after you save it.

---

## Troubleshooting

- **"No Closed/Sold data scope."** Your feed is IDX-only. Go back to your MLS/aggregator and request the data-feed/VOW permission that includes sold listings.
- **"Authentication failed."** Double-check for copy/paste spaces, confirm the credentials are activated (not just issued), and verify the base URL matches your provider.
- **"Access pending."** Approval isn't complete yet — the credentials won't work until your MLS finalizes it.
- **No comps appear after connecting.** Confirm your member ID is correct and that your subscription covers the geographic area you're valuing.

---

## Rules to keep in mind

Your MLS data license comes with conditions. The most common:

- **Attribution** — listings may need to show the source MLS / listing brokerage.
- **Refresh limits** — feeds update on a schedule; near-real-time isn't guaranteed.
- **No redistribution** — you can't resell or republish raw MLS data.

BPO Copilot handles attribution and refresh automatically, but the underlying agreement is between you and your MLS.

---

*Program names, fees, and exact steps vary by MLS. When in doubt, your MLS help desk is the authority — and our support team can help you name BPO Copilot correctly on any request form.*
