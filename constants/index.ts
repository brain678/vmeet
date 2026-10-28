export interface SidebarLink {
  imgURL: string;
  iconName: 'home' | 'upcoming' | 'previous' | 'recordings' | 'attendance' | 'personal-room' | 'profile';
  route: string;
  label: string;
  requiresLecturer?: boolean;
  requiresStudent?: boolean;
}

// All sidebar navigation links
export const sidebarLinks: SidebarLink[] = [
  {
    imgURL: '/icons/Home.svg',
    iconName: 'home',
    route: '/home',
    label: 'Home',
  },
  {
    imgURL: '/icons/upcoming.svg',
    iconName: 'upcoming',
    route: '/home/upcoming',
    label: 'Upcoming',
  },
  {
    imgURL: '/icons/previous.svg',
    iconName: 'previous',
    route: '/home/previous',
    label: 'Previous',
  },
  {
    imgURL: '/icons/Video.svg',
    iconName: 'recordings',
    route: '/home/recordings',
    label: 'Recordings',
  },
  {
    imgURL: '/icons/attendance.svg',
    iconName: 'attendance',
    route: '/home/attendance',
    label: 'Attendance',
    requiresLecturer: true
  },
  {
    imgURL: '/icons/add-personal.svg',
    iconName: 'personal-room',
    route: '/home/personal-room',
    label: 'Personal Room',
  },
  {
    imgURL: '/icons/profile.svg',
    iconName: 'profile',
    route: '/profile',
    label: 'Profile',
    requiresStudent: true,
  },
];
