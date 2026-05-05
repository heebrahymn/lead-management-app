import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://gejmzlzuddwdipcromni.supabase.co',
  'sb_publishable_2CjqTI8B_cnB5mzNLXo4AQ_i1Jaj1o_'
)

async function audit() {
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select('created_at, direction')
    .order('created_at', { ascending: false })
    .limit(10000)

  if (error) {
    console.error(error)
    return
  }

  const counts = {};
  data.forEach(msg => {
    const day = new Date(msg.created_at).toISOString().split('T')[0];
    if (!counts[day]) counts[day] = { inbound: 0, outbound: 0 };
    counts[day][msg.direction]++;
  });

  console.log("Daily message counts in Database:");
  console.table(counts);
}

audit()
