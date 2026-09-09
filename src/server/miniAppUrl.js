// One configured destination for Telegram entry and agent notification buttons.
// Missing configuration must not silently send people to a historical bot.
export function miniAppUrl(startParam, env=process.env) {
  const explicit=env.MINI_APP_URL?.trim();
  const bot=(env.TELEGRAM_BOT_USERNAME || '').trim().replace(/^@/,'');
  const base=explicit || (bot ? 'https://t.me/'+bot : env.PUBLIC_BASE_URL?.trim());
  if(!base)return null;
  try {
    const url=new URL(base);
    if(!['https:','http:'].includes(url.protocol))return null;
    if(startParam!==undefined)url.searchParams.set('startapp',startParam);
    else if(!explicit && bot)url.searchParams.set('startapp','');
    return url.toString();
  }catch{return null;}
}
