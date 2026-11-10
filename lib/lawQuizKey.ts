import sql from '@/lib/db'
import type { LawQuestion } from '@/lib/lawQuiz'

// Hand-written scenario quizzes for the laws that matter most. They replace the mechanical two-question quizzes (made by lib/lawQuizGen.ts) on those laws only;
// a quiz the owner wrote or edited is never touched. Each law is found by words in its text.
const K: { re: RegExp; quiz: LawQuestion[] }[] = [
  { re: /No personal phone number, yours or any staff member/i, quiz: [
    { q: 'A regular customer asks for your own number "so I can reach you directly". What do you do?', options: ['Give it: they are a regular', 'Give the company number and offer to send the update on the company WhatsApp', 'Give a colleague\'s number instead', 'Write it on the receipt'], answer: 1, why: 'Work goes only through the company number, so every conversation is in the company chat.' },
    { q: 'Whose personal phone number may be given to a customer?', options: ['Joe\'s only', 'Nobody\'s, yours or any staff member\'s', 'The owner\'s only', 'Anyone\'s if the customer insists'], answer: 1, why: 'No personal number, yours or any staff member\'s, is given to any customer.' } ] },
  { re: /No personal Mobile Money number is given to customers/i, quiz: [
    { q: 'A customer wants to pay by Mobile Money and the till MoMo is busy. What do you do?', options: ['Give your own MoMo number to save time', 'Give the company Mobile Money number only', 'Ask them to pay a colleague', 'Tell them to pay tomorrow'], answer: 1, why: 'Customers pay only to the company Mobile Money number, which is the company number.' } ] },
  { re: /Keep customer details and logins private/i, quiz: [
    { q: 'A customer leaves their email login on a USB drive after you finish their job. What do you do?', options: ['Keep a copy in case they come back', 'Delete it or hand it back as agreed, and never reuse it', 'Share it with a colleague who needs the same service', 'Save it on the desktop'], answer: 1, why: 'Never share or reuse customer details, files or logins.' } ] },
  { re: /No staff should use their personal email accounts/i, quiz: [
    { q: 'You need to sign in to a browser on the shop laptop. Which account do you use?', options: ['Your personal Gmail', 'The company account, in your own Chrome profile', 'A friend\'s account', 'No sign-in at all'], answer: 1, why: 'Each staff member works in their own Chrome profile with the company account only.' } ] },
  { re: /Company passwords, emails and recovery details are never changed by staff/i, quiz: [
    { q: 'A company account asks you to change its password. What do you do?', options: ['Change it and tell Joe later', 'Do not change it; tell Joe or Grony', 'Change it to something easy to remember', 'Write the new password on the wall'], answer: 1, why: 'Staff never change company passwords, emails or recovery details.' } ] },
  { re: /No customer face, CV or document is posted without the customer's permission/i, quiz: [
    { q: 'You made a lovely passport photo and want to post it as an advert. What first?', options: ['Post it: it is good publicity', 'Ask the customer for permission before posting', 'Blur the name only', 'Post it with the price'], answer: 1, why: 'No customer face, CV or document is posted without the customer\'s permission.' } ] },
  { re: /Log every customer complaint and every case of staff incompetence/i, quiz: [
    { q: 'A customer is unhappy about a late job and leaves. What do you do?', options: ['Forget it: they have gone', 'Log it on the complaint log with the date and details', 'Tell only the next customer', 'Delete the sale'], answer: 1, why: 'Every complaint goes on the complaint log, left of the glass showcase, with date and details.' } ] },
  { re: /Proofread names, dates and index numbers before printing/i, quiz: [
    { q: 'You are about to print 200 copies of an exam form. What do you do first?', options: ['Print all 200 and check afterwards', 'Proofread names, dates and index numbers, and check the first printout\'s quality and size', 'Ask the customer to wait outside', 'Print on cheaper paper'], answer: 1, why: 'Proofread before printing; for many copies check the first printout.' } ] },
  { re: /Every Wednesday, test the fire alarm/i, quiz: [
    { q: 'On which day is the fire alarm tested?', options: ['Monday', 'Wednesday', 'Friday', 'Only after a fire'], answer: 1, why: 'Every Wednesday, test the fire alarm.' } ] },
  { re: /Everyone can use the extinguisher: Pull, Aim, Squeeze, Sweep/i, quiz: [
    { q: 'What is the right order for using the extinguisher?', options: ['Squeeze, Pull, Sweep, Aim', 'Pull, Aim, Squeeze, Sweep', 'Aim, Sweep, Pull, Squeeze', 'Sweep, Squeeze, Aim, Pull'], answer: 1, why: 'Pull, Aim, Squeeze, Sweep. Switch off at the mains first if it is safe.' } ] },
  { re: /Power cut: keep the UPS off when there is no work/i, quiz: [
    { q: 'The power goes off in the middle of the day. What do you do with the UPS?', options: ['Leave it on to save time', 'Keep it off when there is no work and on only when needed, and put things back when power returns', 'Unplug the printers', 'Switch off the laptops and leave'], answer: 1, why: 'UPS off when there is no work, on only when needed; restore everything the moment power returns.' } ] },
  { re: /No eating or drinking at the front panel/i, quiz: [
    { q: 'It is lunch time and you are at the front panel. Where do you eat?', options: ['At the front tables', 'Away from the front panel', 'Beside the printer', 'On the counter'], answer: 1, why: 'No eating or drinking at the front panel, and no food, water or bags on the front tables.' } ] },
  { re: /Every sale to a known customer carries their GM number or 10-digit phone/i, quiz: [
    { q: 'A known customer buys passport photos. What goes in the GM box?', options: ['Nothing', 'Their GM number or 10-digit phone number', 'Your own number', 'The price'], answer: 1, why: 'Every sale to a known customer carries their GM number or phone; otherwise use a label.' } ] },
  { re: /Customers are seated\. They stand only for passport photos/i, quiz: [
    { q: 'When may a customer stand at the counter?', options: ['Always', 'Only for passport photos or large format', 'Never', 'Only when it is busy'], answer: 1, why: 'Customers are seated. They stand only for passport photos or large format.' } ] },
]

export async function betterQuizzesOnce() {
  try {
    await sql`CREATE TABLE IF NOT EXISTS law_migrations (key TEXT PRIMARY KEY, done_at TIMESTAMPTZ NOT NULL DEFAULT now())`
    const c = await sql`INSERT INTO law_migrations (key) VALUES ('key-law-quizzes-v1') ON CONFLICT DO NOTHING RETURNING key`
    if (!c.length) return
    const rows = await sql`SELECT id, text, quiz FROM page_laws WHERE status = 'live'` as unknown as { id: number; text: string; quiz: string | null }[]
    for (const r of rows) {
      const k = K.find(x => x.re.test(r.text)); if (!k) continue
      const mechanical = !r.quiz || r.quiz === '[]' || r.quiz.includes('THIS law (the one you are reading and signing)') || r.quiz.includes('Which of these is a Company Law?')
      if (mechanical) await sql`UPDATE page_laws SET quiz = ${JSON.stringify(k.quiz)} WHERE id = ${r.id}`
    }
  } catch (e) { console.error('key law quizzes failed:', e instanceof Error ? e.message : String(e)) }
}
