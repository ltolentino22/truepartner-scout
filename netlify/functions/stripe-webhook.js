const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const stripeEvent = body;

    if (stripeEvent.type === 'checkout.session.completed') {
      const session = stripeEvent.data.object;
      const customerEmail = session.customer_details?.email;

      if (customerEmail) {
        // Find user by email in Supabase auth
        const { data: users } = await supabase.auth.admin.listUsers();
        const user = users?.users?.find(u => u.email === customerEmail);

        if (user) {
          await supabase
            .from('profiles')
            .upsert({
              id: user.id,
              plan: 'pro',
              stripe_customer_id: session.customer,
              updated_at: new Date().toISOString()
            });
        }
      }
    }

    if (stripeEvent.type === 'customer.subscription.deleted') {
      const subscription = stripeEvent.data.object;
      const customerId = subscription.customer;

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .single();

      if (profile) {
        await supabase
          .from('profiles')
          .update({ plan: 'free', updated_at: new Date().toISOString() })
          .eq('id', profile.id);
      }
    }

    return { statusCode: 200, body: 'OK' };
  } catch (err) {
    return { statusCode: 400, body: err.message };
  }
};
