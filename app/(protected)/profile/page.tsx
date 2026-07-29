import ProfileTab from '../item/_components/ProfileTab'

// Profile now lives as a tab on each staff member's own Personal page (see
// StaffPersonTab) instead of the hamburger menu -- this route is kept
// working for anyone with it bookmarked, just no longer linked from there.
export default function ProfilePage() {
  return (
    <div className="py-4">
      <h1 className="text-xl font-bold max-w-md mx-auto mb-4">My Profile</h1>
      <ProfileTab />
    </div>
  )
}
