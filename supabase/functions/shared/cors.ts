// Allow requests from any origin. For more security, you could
// limit this to your app's domain in production.
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
