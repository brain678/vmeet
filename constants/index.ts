export interface SidebarLink {
  imgURL: string;
  route: string;
  label: string;
  requiresLecturer?: boolean;
}

// All sidebar navigation links
export const sidebarLinks: SidebarLink[] = [
  {
    imgURL: '/icons/Home.svg',
    route: '/home',
    label: 'Home',
  },
  {
    imgURL: '/icons/upcoming.svg',
    route: '/home/upcoming',
    label: 'Upcoming',
  },
  {
    imgURL: '/icons/previous.svg',
    route: '/home/previous',
    label: 'Previous',
  },
  {
    imgURL: '/icons/Video.svg',
    route: '/home/recordings',
    label: 'Recordings',
  },
  {
    imgURL: '/icons/checked.svg',
    route: '/records',
    label: 'Attendance',
    requiresLecturer: true
  },
  {
    imgURL: '/icons/add-personal.svg',
    route: '/home/personal-room',
    label: 'Personal Room',
  },
];
