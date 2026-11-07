// Daily one-question scenario quiz for the start-of-day customer service card. One question per day, the same
// for everyone, rotating. `answer` is the index of the right option.
export type QuizQ = { id: number; scenario: string; options: string[]; answer: number; why: string }

export const QUIZ: QuizQ[] = [
  { id: 1, scenario: 'A customer walks in while you are on a phone call to a friend.', options: ['Finish the call first', 'Acknowledge them, end the call and greet them', 'Wave and keep talking'], answer: 1, why: 'Greet within 10 seconds and keep your phone away from customers. (CS-6, CS-7)' },
  { id: 2, scenario: 'A customer asks for your personal phone number "for easy contact".', options: ['Give it, they seem nice', 'Give the company number 053 432 8977', 'Give your MoMo number so they can pay you'], answer: 1, why: 'No personal phone or MoMo number is ever given. Use the company number. (CS-17)' },
  { id: 3, scenario: 'You are serving one customer and a second one arrives.', options: ['Ignore until you finish', 'Say "I\'ll be with you shortly" and offer a seat', 'Tell them to come back later'], answer: 1, why: 'Acknowledge new customers and offer a seat. (CS-8)' },
  { id: 4, scenario: 'A customer wants a large print but you are not sure of the price.', options: ['Guess a price that sounds right', 'Say "Let me check" and ask a colleague or the manager', 'Tell them it is expensive'], answer: 1, why: 'Never guess prices. Check first. (CS-13)' },
  { id: 5, scenario: 'You realise you made a spelling mistake on a customer\'s print.', options: ['Hope they do not notice', 'Tell them, apologise and reprint at no extra charge', 'Charge them for a reprint'], answer: 1, why: 'Own the mistake and fix it free of charge. (CS-22)' },
  { id: 6, scenario: 'A customer is angry about waiting too long and starts shouting.', options: ['Shout back to defend yourself', 'Stay calm, apologise and say what you will do', 'Walk away'], answer: 1, why: 'Stay calm, apologise, and explain the next step. (CS-25)' },
  { id: 7, scenario: 'A job will not be ready at the time you promised.', options: ['Say nothing until they come', 'Tell the customer before they ask and give a new time', 'Blame the machine'], answer: 1, why: 'Tell customers before they ask if you will be late. (CS-23)' },
  { id: 8, scenario: 'A customer wants to pay your personal MoMo number to "avoid queues".', options: ['Accept it, it is faster', 'Politely say payment goes to the company MoMo number or the till', 'Ask them to send half now'], answer: 1, why: 'Payments go only to the company MoMo number or the till. (CS-17)' },
  { id: 9, scenario: 'A customer asks you about another customer\'s job.', options: ['Share it, it is not a secret', 'Politely say you cannot discuss other customers', 'Show them the other customer\'s files'], answer: 1, why: 'Never discuss one customer with another or share their details. (CS-15, CS-19)' },
  { id: 10, scenario: 'The customer is about to pay for a printed banner.', options: ['Take the money and wrap it', 'Check size, colour, spelling and quantity with them first', 'Let them check at home'], answer: 1, why: 'Check the work with the customer before they pay. (CS-21)' },
  { id: 11, scenario: 'A customer is difficult and you cannot solve the problem.', options: ['Argue until they give up', 'Politely call the manager', 'Tell them to go away'], answer: 1, why: 'If you cannot resolve it, call the manager politely. (CS-27)' },
  { id: 12, scenario: 'You finish a sale for a walk-in customer.', options: ['Say nothing and start the next job', 'Thank them, give the receipt and say when to expect pickup', 'Wave goodbye only'], answer: 1, why: 'Close every sale with thanks, a receipt and the pickup time. (CS-29)' },
  { id: 13, scenario: 'A customer buys something small (GH₵2) while another is buying a lot.', options: ['Serve only the big spender', 'Treat both politely and equally', 'Rush the small customer'], answer: 1, why: 'Every customer is treated the same. (CS-9)' },
  { id: 14, scenario: 'A customer has a complaint about last week\'s work.', options: ['Say it is not your problem', 'Listen, apologise, and log it on the complaint log', 'Ask them to come back when Joe is here'], answer: 1, why: 'Log every complaint with date and details. (CS-25, CS-28)' },
  { id: 15, scenario: 'A customer finishes and is about to leave.', options: ['Let them go', 'Invite them to join our WhatsApp page and send the receipt there', 'Ask for a tip'], answer: 1, why: 'Invite customers to WhatsApp and send the receipt there. (CS-30)' },
]

export function quizOfDay(dateStr: string): QuizQ {
  const day = Math.floor(Date.parse(dateStr + 'T00:00:00Z') / 86400000)
  return QUIZ[((day % QUIZ.length) + QUIZ.length) % QUIZ.length]
}
