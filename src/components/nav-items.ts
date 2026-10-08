// Plain, serializable navigation data shared by server layouts and the client nav.

export interface NavItem {
  href: string;
  label: string;
  /** SVG path data (24x24 viewBox, stroke icons). */
  icon: string;
  exact?: boolean;
}

export const icons = {
  home: "M3 12l9-9 9 9M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10",
  quizzes: "M4 5a2 2 0 0 1 2-2h8l6 6v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5zM14 3v6h6M8 13h8M8 17h5",
  plus: "M12 5v14M5 12h14",
  chart: "M3 3v18h18M8 17V9M13 17V5M18 17v-7",
  settings:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4",
  users: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  inbox: "M22 12h-6l-2 3h-4l-2-3H2M5.5 5.1L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.8 1.1z",
  log: "M12 8v4l3 3M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  gauge: "M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 12l3-3M12 4v2M20 12h-2M4 12h2",
};

export const teacherNavItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: icons.home },
  { href: "/quizzes", label: "My Quizzes", icon: icons.quizzes },
  { href: "/quizzes/new", label: "Create Quiz", icon: icons.plus, exact: true },
  { href: "/results", label: "Results", icon: icons.chart },
  { href: "/settings", label: "Settings", icon: icons.settings },
];

export const adminNavItems: NavItem[] = [
  { href: "/admin", label: "Overview", icon: icons.gauge, exact: true },
  { href: "/admin/teachers", label: "Teachers", icon: icons.users },
  { href: "/admin/quizzes", label: "Quizzes", icon: icons.quizzes },
  { href: "/admin/submissions", label: "Submissions", icon: icons.inbox },
  { href: "/admin/audit", label: "Audit Log", icon: icons.log },
  { href: "/admin/settings", label: "Platform Settings", icon: icons.settings },
];
