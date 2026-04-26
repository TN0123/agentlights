export async function test() {
  const color = process.env.AGENTLIGHTS_WAITING_COLOR ?? '#2a2733';
  console.log(`Setting background to ${color} for 3 seconds...`);
  process.stdout.write(`\x1b]11;${color}\x1b\\`);
  await new Promise((r) => setTimeout(r, 3000));
  process.stdout.write(`\x1b]111\x1b\\`);
  console.log(`Reset to default. If you saw the color change, you're good.`);
}
