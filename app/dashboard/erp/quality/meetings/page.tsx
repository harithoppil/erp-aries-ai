import { listMeetings, type ClientSafeMeeting } from './actions';
import MeetingsClient from './meetings-client';

export default async function MeetingsPage() {
  const result = await listMeetings();
  const meetings = result.success ? result.meetings : [];
  return <MeetingsClient initialMeetings={meetings} />;
}
