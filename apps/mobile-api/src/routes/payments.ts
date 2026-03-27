import { Router } from 'express';
import { requireAuth, getUser } from '../auth.js';

const router = Router();
router.use(requireAuth);

// POST /payments/checkout-url — generate a Stripe Checkout URL for a lead
router.post('/checkout-url', async (req, res) => {
  try {
    const { demo_id, business_name, customer_email } = req.body;
    const { user_id } = getUser(req);

    if (!demo_id || !business_name) {
      return res.status(400).json({ error: 'Missing required fields: demo_id, business_name' });
    }

    // Dynamic import to avoid loading stripe at startup if keys aren't set
    const { createCheckoutSession } = await import('../../../../packages/stripe/index.js');

    const session = await createCheckoutSession({
      demoId: demo_id,
      salespersonId: user_id,
      businessName: business_name,
      customerEmail: customer_email,
      successUrl: `${req.headers.origin ?? 'http://localhost:4300'}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${req.headers.origin ?? 'http://localhost:4300'}/payment/cancelled`,
    });

    res.json({ url: session.url, session_id: session.id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[payments/checkout-url] Error:', message);
    res.status(500).json({ error: message });
  }
});

// GET /payments/status/:demo_id — check payment status for a demo
router.get('/status/:demo_id', async (req, res) => {
  try {
    const { demo_id } = req.params;
    const { createServiceClient } = await import('../../../../packages/supabase/index.js');
    const supabase = createServiceClient();

    const { data } = await supabase
      .from('pitch_outcomes')
      .select('stripe_payment_confirmed, stripe_payment_id, outcome')
      .eq('demo_id', demo_id)
      .single();

    if (!data) {
      return res.json({ paid: false, outcome: null });
    }

    res.json({
      paid: data.stripe_payment_confirmed ?? false,
      payment_id: data.stripe_payment_id,
      outcome: data.outcome,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[payments/status] Error:', message);
    res.status(500).json({ error: message });
  }
});

// POST /payments/connect-onboard — start Stripe Connect onboarding for salesperson
router.post('/connect-onboard', async (req, res) => {
  try {
    const { user_id } = getUser(req);
    const { email, display_name } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Missing required field: email' });
    }

    const { createConnectAccount, createConnectOnboardingLink } = await import('../../../../packages/stripe/index.js');
    const { createServiceClient } = await import('../../../../packages/supabase/index.js');
    const supabase = createServiceClient();

    // Check existing
    const { data: sp } = await supabase
      .from('salesperson_metrics')
      .select('stripe_connect_id')
      .eq('user_id', user_id)
      .single();

    let connectAccountId = sp?.stripe_connect_id;

    if (!connectAccountId) {
      const account = await createConnectAccount(email, display_name);
      connectAccountId = account.id;

      await supabase
        .from('salesperson_metrics')
        .update({ stripe_connect_id: connectAccountId })
        .eq('user_id', user_id);
    }

    const origin = req.headers.origin ?? 'http://localhost:4300';
    const onboardingUrl = await createConnectOnboardingLink(
      connectAccountId,
      `${origin}/settings/payout-setup?complete=true`,
      `${origin}/settings/payout-setup?refresh=true`,
    );

    res.json({ url: onboardingUrl, connect_account_id: connectAccountId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[payments/connect-onboard] Error:', message);
    res.status(500).json({ error: message });
  }
});

export default router;
