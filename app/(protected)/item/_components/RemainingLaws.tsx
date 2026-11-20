'use client'

// The places in the app that still send people to the general Company Laws page, and what each one needs before that page
// can be removed. Nothing here changes anything: it is the list to decide from.
const ITEMS: { where: string; what: string; goesTo: string; decide: string }[] = [
  { where: 'Shop bar: "📜 Laws" row', what: 'Staff and managers see it. Opens the general Laws page.', goesTo: 'The general Laws page', decide: 'Send it to Staff rules on Manage, or drop the row.' },
  { where: 'Voice command: "Company Laws" / "laws"', what: 'Spoken commands in the hub and the mic helper open the general Laws page.', goesTo: 'The general Laws page', decide: 'Which page should it open?' },
  { where: 'Reminder emails and messages', what: 'Two lines say "Read the full laws, with the video, in Company Laws".', goesTo: 'The general Laws page', decide: 'Link to Waiting for me, or to one topic?' },
  { where: 'Penalty Points page: "Company Laws" link', what: 'Points are charged under many topics, not just staff.', goesTo: 'The general Laws page', decide: 'Staff rules, or a link to each topic?' },
  { where: 'Drafts waiting approval (Waiting list and My Day)', what: 'Laws not yet approved. Each is approved on its own topic page.', goesTo: 'The general Laws page', decide: 'Which topic should the drafts link open?' },
  { where: 'Access and embed lists (sign-in guard, embedded-page list)', what: 'The app lists "/laws" as an allowed or embeddable page.', goesTo: '/laws', decide: 'Remove when the general page is removed.' },
]

export default function RemainingLaws() {
  return (
    <div className="mx-auto max-w-2xl space-y-3 p-3">
      <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
        <p className="font-bold">Remaining laws to fix</p>
        <p>These still send people to the general Company Laws page. Decide where each one goes; then the general page can be removed. Nothing here has been changed yet.</p>
      </div>
      <div className="space-y-2">
        {ITEMS.map(it => (
          <div key={it.where} className="rounded-xl border border-gray-200 bg-white px-3 py-2">
            <p className="text-[14px] font-bold text-gray-900">{it.where}</p>
            <p className="text-[13px] text-gray-700">{it.what}</p>
            <p className="mt-1 text-[12px] text-gray-500">Goes to now: {it.goesTo}</p>
            <p className="text-[12px] font-semibold text-blue-800">Decide: {it.decide}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
