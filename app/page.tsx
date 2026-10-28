import Image from 'next/image'
import {
  BarChart3,
  BookOpenCheck,
  ClipboardList,
  GraduationCap,
  LogIn,
  MonitorPlay,
  Target,
  UserPlus,
  Users,
} from 'lucide-react'

const featureCards = [
  {
    title: 'Physical Attendance',
    description: 'Record and manage attendance in physical classes.',
    Icon: ClipboardList,
    iconBg: 'bg-[#E6F1FF]',
    iconColor: 'text-[#2A1856]',
  },
  {
    title: 'Virtual Attendance',
    description: 'Track attendance during online sessions.',
    Icon: MonitorPlay,
    iconBg: 'bg-[#F1E4FF]',
    iconColor: 'text-[#2A1856]',
  },
  {
    title: 'Student Engagement',
    description: 'Monitor participation and classroom activity.',
    Icon: Users,
    iconBg: 'bg-[#E7F8F4]',
    iconColor: 'text-[#2A1856]',
  },
  {
    title: 'Learning Engagement',
    description: 'Keep classes, students and learning activities organized.',
    Icon: BookOpenCheck,
    iconBg: 'bg-[#FFF2CC]',
    iconColor: 'text-[#2A1856]',
  },
]

const modernLearningCards = [
  {
    title: 'Physical Attendance',
    description: 'Fast, accurate and reliable attendance capture',
    Icon: ClipboardList,
    iconBg: 'bg-[#D7E9FF]',
    iconColor: 'text-[#2D1B4A]',
  },
  {
    title: 'Virtual Attendance',
    description: 'Track online attendance during sessions',
    Icon: MonitorPlay,
    iconBg: 'bg-[#E8D9FF]',
    iconColor: 'text-[#2D1B4A]',
  },
  {
    title: 'Student Engagement',
    description: 'Understand participation, interactions and class activity.',
    Icon: GraduationCap,
    iconBg: 'bg-[#D9F1E4]',
    iconColor: 'text-[#2D1B4A]',
  },
  {
    title: 'Interactive Learning',
    description: 'Chat, raise hand, polls and real-time collaboration',
    Icon: BookOpenCheck,
    iconBg: 'bg-[#F7E6A7]',
    iconColor: 'text-[#2D1B4A]',
  },
  {
    title: 'Class Management',
    description: 'Create classes, upload materials and manage schedules',
    Icon: Target,
    iconBg: 'bg-[#D9EAFB]',
    iconColor: 'text-[#2D1B4A]',
  },
  {
    title: 'Reports & Analytics',
    description: 'Powerful insights for attendance and class performance.',
    Icon: BarChart3,
    iconBg: 'bg-[#F8D7F0]',
    iconColor: 'text-[#2D1B4A]',
  },
]

const experienceSections = [
  {
    title: 'Lecturer Experience',
    subtitle: 'Manage every class with clarity and confidence.',
    bg: 'bg-[#DDEEE3]',
    image: '/images/lecturer-experience-dashboard.png',
    list: [
      'Create & manage classes',
      'Monitor virtual attendance',
      'View student participation',
      'Analyse performance',
      'Export detailed reports',
    ],
    buttonText: 'Learn more',
  },
  {
    title: 'Student Experience',
    subtitle: 'Stay organized, stay informed, stay ahead.',
    bg: 'bg-[#E9DEF5]',
    image: '/images/student-experience-dashboard.png',
    list: [
      'View upcoming classes',
      'Check attendance status',
      'Join virtual classes',
      'Access learning materials',
      'Track engagements',
      'Receive notifications',
    ],
    buttonText: 'Learn more',
  },
]

const workflowSteps = [
  {
    title: 'Create',
    description: 'Create a class or learning session',
    Icon: Target,
    iconBg: 'bg-[#D7F1E8]',
  },
  {
    title: 'Attend',
    description: 'Students attend physically or virtually',
    Icon: MonitorPlay,
    iconBg: 'bg-[#DDE7FF]',
  },
  {
    title: 'Engage',
    description: 'Participate, interact and learn together.',
    Icon: Users,
    iconBg: 'bg-[#E9D9FF]',
  },
  {
    title: 'Track',
    description: 'Attendance and engagement are recorded',
    Icon: BarChart3,
    iconBg: 'bg-[#F7E8B9]',
  },
]

const faqItems = [
  {
    question: 'What is V-Meet?',
    answer:
      'V-Meet is a learning and attendance platform that connects students and lecturers in one place. It supports both physical and virtual classes, making it easier to manage attendance, engagement and learning outcomes.',
  },
  {
    question: 'Can V-Meet track both physical and virtual attendance?',
    answer: '',
  },
  {
    question: 'How does V-Meet record attendance during physical classes?',
    answer: '',
  },
  {
    question: 'How does attendance work for virtual classes?',
    answer: '',
  },
  {
    question: 'Who can use V-Meet — students, lecturers, or both?',
    answer: '',
  },
  {
    question: 'What can students do with V-Meet?',
    answer: '',
  },
  {
    question: 'What can lecturers manage through V-Meet?',
    answer: '',
  },
  {
    question: 'Can I view attendance records and reports over time?',
    answer: '',
  },
]

export default function Home() {
  return (
    <main
      className="min-h-screen overflow-hidden pl-0 pr-0 text-slate-900"
      style={{ background: '#F7F5F9' }}
    >
      <header className="flex w-full items-center justify-between px-4 py-5 md:px-8">
        <div className="ml-0 flex items-center">
          <Image src="/images/logo.png" alt="Vmeet" width={120} height={32} priority />
        </div>

        <div className="mr-0 flex items-center gap-3 sm:gap-4">
          <a
            href="/sign-in"
            aria-label="Sign in"
            className="inline-flex h-[39px] w-[39px] items-center justify-center rounded-[5px] border-[1.5px] border-[#2A1856] bg-white text-[#2A1856] transition-colors hover:bg-[#2A1856] hover:text-white sm:h-[39px] sm:w-[138px] sm:text-sm sm:font-medium"
            title="Sign in"
          >
            <span className="hidden sm:inline">Log In</span>
            <LogIn className="h-4 w-4 sm:hidden" strokeWidth={2.4} />
          </a>
          <a
            href="/sign-up"
            aria-label="Sign up"
            className="inline-flex h-[39px] w-[39px] items-center justify-center rounded-[5px] bg-[#2A1856] text-white transition-opacity hover:opacity-90 sm:h-[39px] sm:w-[138px] sm:text-sm sm:font-medium"
            title="Sign up"
          >
            <span className="hidden sm:inline">Get Started</span>
            <UserPlus className="h-4 w-4 sm:hidden" strokeWidth={2.4} />
          </a>
        </div>
      </header>

      <div className="w-full px-0">
        <div className="flex h-[30px] w-full items-center justify-center rounded-[5px] bg-[#A77ABF4D]">
          <span
            className="text-center text-[14px] font-extrabold uppercase"
            style={{ fontFamily: 'Poppins, sans-serif', lineHeight: '140%', color: '#000000' }}
          >
            Smart learning & attendance platform
          </span>
        </div>
      </div>

      <section id="home" className="relative w-full pb-20 pt-12">
        <div className="pointer-events-none absolute left-[-17px] top-[272px] z-0 h-[530px] w-[1457px] opacity-5">
          <Image src="/images/hero.jpg" alt="Hero background" width={1457} height={530} className="h-full w-full object-cover" />
        </div>

        <div className="relative z-10 text-center">
          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8">
            <span className="text-[72px] font-black leading-none tracking-[-0.08em] text-[#2A1856] md:text-[110px]">One</span>
            <div className="relative flex h-[110px] w-[420px] items-center justify-center overflow-hidden rounded-[48px] border-[3px] border-[#2A1856] bg-white/90 shadow-[0_10px_30px_rgba(42,24,86,0.12)] md:h-[150px] md:w-[560px]">
              <div className="absolute inset-0 bg-gradient-to-r from-[#ffffff] via-[#f1ebff] to-[#f5efff]" />
              <Image src="/images/hero.jpg" alt="Classroom hero" width={680} height={220} className="h-full w-full object-cover opacity-90" />
            </div>
            <span className="text-[72px] font-black leading-none tracking-[-0.08em] text-[#8a6ce8] md:text-[110px]">Platform</span>
          </div>

          <h2 className="mt-2 text-[72px] font-black leading-none tracking-[-0.08em] text-[#2A1856] md:text-[110px]">
            Every Classroom
          </h2>

          <p className="mx-auto mt-8 max-w-[760px] text-lg font-medium leading-relaxed text-[#2A1856] opacity-80 md:text-[26px]">
            V-Meet brings physical and virtual learning together, making attendance, engagement and classroom management easier for students and lecturers.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-6">
            <a
              href="/sign-up"
              className="inline-flex h-[72px] items-center justify-center gap-3 rounded-full bg-[#2A1856] px-8 text-xl font-semibold text-white shadow-[0_10px_20px_rgba(42,24,86,0.2)] transition-opacity hover:opacity-90"
            >
              Get Started
              <span className="text-2xl">→</span>
            </a>

            <a
              href="/explore"
              className="inline-flex h-[72px] items-center justify-center gap-3 rounded-full border-[2px] border-[#2A1856] bg-transparent px-8 text-xl font-semibold text-[#2A1856] transition-colors hover:bg-white/40"
            >
              Explore Vmeet
              <span className="text-2xl">◉</span>
            </a>
          </div>
        </div>
      </section>

      <section className="w-full bg-[#8036C5] py-5" aria-label="Feature highlight panel">
        <div className="mx-auto grid max-w-[420px] grid-cols-1 gap-3 px-3 sm:max-w-[520px] md:max-w-[1500px] md:grid-cols-2 xl:grid-cols-4">
          {featureCards.map(({ title, description, Icon, iconBg, iconColor }) => (
            <div
              key={title}
              className="flex h-auto min-h-[85px] w-full items-center gap-2.5 rounded-[5px] border border-white/10 bg-[rgba(167,122,191,0.53)] p-2.5 text-white shadow-[0_2px_8px_rgba(42,24,86,0.10)] md:max-w-none"
            >
              <div className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px] shadow-[0_1px_3px_rgba(42,24,86,0.12)] ${iconBg}`}>
                <Icon className={`h-3.5 w-3.5 ${iconColor}`} strokeWidth={2.2} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-[14px] font-bold leading-[1.3] tracking-[-0.03em] text-white sm:text-[16px]">{title}</h3>
                <p className="mt-0.5 text-[11px] leading-[1.5] text-white/90 sm:text-[12px]">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="platform" className="w-full py-16" style={{ backgroundColor: '#FFFFFF' }}>
        <div className="mx-auto max-w-[1200px] px-4">
          <div className="mx-auto max-w-[860px] text-center">
            <h3 className="text-[44px] font-black leading-[1.05] tracking-[-0.06em] text-[#2A1856] md:text-[62px]">
              Attendance Shouldn&apos;t Depend
            </h3>
            <h3 className="text-[44px] font-black leading-[1.05] tracking-[-0.06em] text-[#2A1856] md:text-[62px]">
              on Where the Class Happens
            </h3>
            <p className="mx-auto mt-4 max-w-[780px] text-base font-medium text-[#2A1856]/75 md:text-[17px]">
              Tools are limited, records get lost, students slip through the cracks. It&apos;s hard to get the full picture
            </p>
          </div>

          <div className="mt-12 grid items-start gap-6 md:grid-cols-3">
            <div className="relative rounded-[18px] border border-[#D7E8D7] bg-[#FFFFFF] p-4 shadow-[0_10px_28px_rgba(42,24,86,0.04)]">
              <div className="mb-4 flex items-center justify-between">
                <span className="rounded-[6px] bg-[#D7F0E0] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#2A1856]">
                  Physical Class
                </span>
              </div>

              <div className="relative h-[150px] overflow-hidden rounded-[12px] bg-[#D7F0E0] p-0">
                <Image src="/images/pc1.png" alt="Physical class attendance example" width={420} height={240} className="h-full w-full object-cover" />
              </div>

              <div className="mt-5 flex items-start gap-3 text-black">
                <span className="mt-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#2FD66B] text-[10px] text-white">✓</span>
                <div>
                  <p className="text-[15px] font-bold leading-snug text-black">Manual or paper records</p>
                  <p className="text-[13px] text-black/80">Hard to track consistently</p>
                  <p className="text-[13px] text-black/80">Time consuming</p>
                </div>
              </div>
            </div>

            <div className="relative rounded-[18px] border border-[#8E6CC6]/20 bg-[#FFFFFF] p-4 shadow-[0_10px_28px_rgba(42,24,86,0.08)]">
              <div className="mb-4 flex items-center justify-between">
                <span className="rounded-[6px] bg-[#F1E4FF] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#2A1856]">
                  Vmeet
                </span>
              </div>

              <div className="relative h-[150px] overflow-hidden rounded-[12px] bg-[#20123E] p-0">
                <Image src="/images/pc2.png" alt="Virtual class attendance example" width={420} height={240} className="h-full w-full object-cover" />
              </div>

              <div className="mt-5 flex items-start gap-3 text-black">
                <span className="mt-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#2FD66B] text-[10px] text-white">✓</span>
                <div>
                  <p className="text-[15px] font-bold leading-snug text-black">One unified platform</p>
                  <p className="text-[13px] text-black/80">Accurate & real time record</p>
                  <p className="text-[13px] text-black/80">Complete visibility</p>
                </div>
              </div>
            </div>

            <div className="relative rounded-[18px] border border-[#D7E4FF] bg-[#FFFFFF] p-4 shadow-[0_10px_28px_rgba(42,24,86,0.04)]">
              <div className="mb-4 flex items-center justify-between">
                <span className="rounded-[6px] bg-[#D9E8FF] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#2A1856]">
                  Online Class
                </span>
              </div>

              <div className="relative h-[150px] overflow-hidden rounded-[12px] bg-[#D8E8FF] p-0">
                <Image src="/images/pc3.png" alt="Online class attendance example" width={420} height={240} className="h-full w-full object-cover" />
              </div>

              <div className="mt-5 flex items-start gap-3 text-black">
                <span className="mt-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#2FD66B] text-[10px] text-white">✓</span>
                <div>
                  <p className="text-[15px] font-bold leading-snug text-black">No consistent tracking</p>
                  <p className="text-[13px] text-black/80">Missed participation</p>
                  <p className="text-[13px] text-black/80">Disconnected records</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-16 text-center">
            <h4 className="text-[28px] font-bold tracking-[-0.05em] text-[#2A1856] md:text-[42px]">
              <span className="font-black">One Platform.</span>
            </h4>
            <h4 className="mt-2 text-[28px] font-black leading-[1.05] tracking-[-0.06em] text-[#2A1856] md:text-[60px]">
              Whether you&apos;re in the classroom or online.
            </h4>
          </div>

          <div className="mx-auto mt-12 max-w-[1100px] rounded-[20px] bg-[#FFFFFF] p-4 shadow-[0_14px_30px_rgba(42,24,86,0.05)] md:p-6">
            <div className="grid gap-5 md:grid-cols-[0.92fr_1.08fr]">
              <div className="rounded-[18px] border border-[#D4E7D7] bg-[#DFF4E7] p-5 md:p-6">
                <div className="flex items-center justify-between">
                  <span className="rounded-[6px] bg-[#FFFFFF]/90 px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#2A1856]">
                    Virtual Classroom
                  </span>
                </div>

                <div className="mt-5 space-y-3 text-left text-[#2A1856]">
                  <p className="text-[15px] font-medium leading-[1.45] text-[#2A1856]">Capture attendance and participation during live online sessions.</p>
                  <p className="text-[15px] font-medium leading-[1.45] text-[#2A1856]">NICE attendance tracking</p>
                  <p className="text-[15px] font-medium leading-[1.45] text-[#2A1856]">Participation monitoring</p>
                  <p className="text-[15px] font-medium leading-[1.45] text-[#2A1856]">Chat &amp; interaction</p>
                  <p className="text-[15px] font-medium leading-[1.45] text-[#2A1856]">Engagement insights</p>
                </div>
              </div>

              <div className="flex items-center justify-center rounded-[18px] border border-[#E7EAF6] bg-[#F7F8FF] p-3 md:p-4">
                <div className="w-full max-w-[640px] overflow-hidden rounded-[18px] bg-white shadow-[0_8px_20px_rgba(42,24,86,0.08)]">
                  <Image src="/images/vc1.png" alt="Vmeet dashboard mockup" width={820} height={420} className="h-[250px] w-full object-cover md:h-[290px]" />
                </div>
              </div>
            </div>
          </div>

          <div className="mx-auto mt-16 max-w-[1200px] rounded-[18px] bg-[#FFFFFF] p-4 shadow-[0_14px_30px_rgba(42,24,86,0.04)] md:p-6">
            <div className="grid items-center gap-6 md:grid-cols-[0.8fr_1.2fr]">
              <div className="rounded-[18px] border border-[#D5E7D9] bg-[#EAF8EE] p-6">
                <h5 className="text-[24px] font-black tracking-[-0.04em] text-[#2A1856]">Physical Classroom</h5>
                <ul className="mt-4 space-y-3 text-[15px] leading-[1.5] text-[#2A1856]/80">
                  <li>• Take attendance instantly using QR code + PIN or manual check-in.</li>
                  <li>• QR Code check-in</li>
                  <li>• Manual attendance</li>
                  <li>• Face verification</li>
                  <li>• Instant records</li>
                </ul>
              </div>

              <div className="rounded-[18px] bg-[#F7F9FF] p-4">
                <div className="mb-3 flex items-center justify-between px-1">
                  <span className="rounded-[6px] bg-[#F1E4FF] px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#2A1856]">
                    Attendance
                  </span>
                  <span className="rounded-[6px] bg-[#DFF4E7] px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#2A1856]">
                    Check-in
                  </span>
                </div>

                <div className="overflow-hidden rounded-[16px] border border-[#E5EAF8] bg-white p-2">
                  <Image src="/images/phc1.png" alt="Physical classroom attendance check-in" width={720} height={400} className="h-[230px] w-full object-cover md:h-[260px]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section id="features" className="w-full py-16 md:py-20" style={{ backgroundColor: '#C7B1D8' }} aria-label="Modern learning features">
        <div className="mx-auto max-w-[1200px] px-4">
          <h2 className="mb-10 text-center text-[30px] font-black leading-[1.1] tracking-[-0.06em] text-[#2D1B4A] md:text-[46px]">
            Everything you need to manage modern learning
          </h2>

          <div className="mx-auto grid max-w-[1000px] grid-cols-1 gap-6 md:grid-cols-3">
            {modernLearningCards.map(({ title, description, Icon, iconBg, iconColor }) => (
              <div
                key={title}
                className="flex h-[220px] flex-col items-center justify-center rounded-[22px] bg-white p-5 text-center shadow-[0_6px_18px_rgba(42,24,86,0.06)]"
              >
                <div className={`mb-4 flex h-[64px] w-[64px] items-center justify-center rounded-[18px] ${iconBg}`}>
                  <Icon className={`h-8 w-8 ${iconColor}`} strokeWidth={2.1} />
                </div>
                <h3 className="text-[18px] font-bold leading-[1.3] tracking-[-0.03em] text-[#2D1B4A]">{title}</h3>
                <p className="mt-2 max-w-[230px] text-[14px] leading-[1.5] text-[#2D1B4A]/80">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="w-full bg-[#F5F3F6] py-16 md:py-20">
        <div className="mx-auto max-w-[1200px] space-y-8 px-4">
          {experienceSections.map(({ title, subtitle, bg, image, list, buttonText }) => (
            <div
              key={title}
              className={`flex flex-col items-center justify-between gap-6 rounded-[26px] ${bg} p-5 md:flex-row md:p-7 lg:p-8`}
            >
              <div className="w-full max-w-[320px] shrink-0 px-1 md:pr-4">
                <h3 className="text-[30px] font-black leading-[1.05] tracking-[-0.06em] text-[#2D1B4A] md:text-[34px]">
                  {title}
                </h3>

                <p className="mt-3 text-[17px] font-medium leading-[1.5] text-[#2D1B4A] opacity-90">
                  {subtitle}
                </p>

                <ul className="mt-5 space-y-2.5 text-[15px] leading-[1.5] text-[#2D1B4A]">
                  {list.map((item) => (
                    <li key={item} className="flex items-center gap-2.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#2D1B4A]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  className="mt-6 inline-flex h-[44px] items-center justify-center rounded-[10px] border border-[#2D1B4A] bg-transparent px-6 text-[15px] font-semibold text-[#2D1B4A] transition-colors hover:bg-white/30"
                >
                  {buttonText}
                </button>
              </div>

              <div className="w-full flex-1 overflow-hidden rounded-[22px] border border-[#D9D3DE] bg-white/60 p-3 shadow-[0_12px_24px_rgba(45,27,74,0.06)]">
                <div className="overflow-hidden rounded-[18px] bg-white shadow-[0_8px_20px_rgba(45,27,74,0.08)]">
                  <Image
                    src={image}
                    alt={`${title} dashboard preview`}
                    width={920}
                    height={520}
                    className="h-[320px] w-full object-cover md:h-[360px]"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="solutions" className="w-full bg-[#F5F3F6] pb-16 pt-2 md:pb-20 md:pt-2">
        <div className="mx-auto max-w-[1200px] px-4">
          <div className="rounded-[18px] border border-[#E8E0ED] bg-[#F2EAF7] p-6 md:p-7">
            <div className="max-w-[420px]">
              <p className="text-[18px] font-medium leading-[1.4] tracking-[-0.03em] text-[#2D1B4A] md:text-[20px]">
                Every attendance record,
                <span className="block">in one place</span>
              </p>
              <p className="mt-4 text-[14px] leading-[1.5] text-[#2D1B4A]/80 md:text-[15px]">
                Get a complete overview of physical and virtual attendance across all your classes and sessions.
              </p>
            </div>
          </div>

          <div className="mt-10 text-center">
            <h3 className="text-[34px] font-black leading-[1.1] tracking-[-0.06em] text-[#2D1B4A] md:text-[42px]">
              How V-Meet works
            </h3>
          </div>

          <div className="mt-8 grid max-w-[1000px] grid-cols-1 gap-5 md:grid-cols-4 md:gap-6">
            {workflowSteps.map(({ title, description, Icon, iconBg }, index) => (
              <div key={title} className="flex items-center gap-3 md:flex-col md:items-center md:text-center">
                <div className={`flex h-[48px] w-[48px] items-center justify-center rounded-[14px] ${iconBg}`}>
                  <Icon className="h-6 w-6 text-[#2D1B4A]" strokeWidth={2.1} />
                </div>

                <div className="flex-1 md:flex-none">
                  <div className="flex items-center gap-2 md:justify-center">
                    <h4 className="text-[17px] font-bold leading-[1.3] text-[#2D1B4A]">{title}</h4>
                    {index < workflowSteps.length - 1 && (
                      <span className="hidden text-[18px] text-[#2D1B4A]/60 md:inline-block">→</span>
                    )}
                  </div>
                  <p className="mt-1 max-w-[200px] text-[13px] leading-[1.5] text-[#2D1B4A]/70 md:mx-auto">
                    {description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-14 max-w-[1200px] px-4">
          <div className="rounded-[28px] bg-[#7B3FC4] px-6 py-10 text-center text-white shadow-[0_18px_32px_rgba(95,53,148,0.24)] md:px-10">
            <h2 className="text-[32px] font-black leading-[1.05] tracking-[-0.06em] md:text-[46px]">
              Make every class count.
            </h2>
            <p className="mx-auto mt-3 max-w-[650px] text-[18px] font-medium leading-[1.5] text-white/90 md:text-[22px]">
              Bring attendance, learning and engagement together with V-Meet.
            </p>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-4">
              <a
                href="/sign-up"
                className="inline-flex h-[52px] items-center justify-center rounded-full bg-[#2D1B4A] px-7 text-[17px] font-semibold text-white shadow-[0_8px_20px_rgba(23,15,39,0.25)] transition-opacity hover:opacity-90"
              >
                Get Started
                <span className="ml-3 text-lg">→</span>
              </a>

              <button
                type="button"
                className="inline-flex h-[52px] items-center justify-center gap-3 rounded-full border border-white/80 bg-transparent px-7 text-[17px] font-semibold text-white transition-colors hover:bg-white/10"
              >
                Explore Vmeet
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/80 text-sm">◉</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className="w-full bg-[#F5F3F6] py-16 md:py-20">
        <div className="mx-auto max-w-[1200px] px-4">
          <h2 className="mb-10 text-center text-[30px] font-black leading-[1.1] tracking-[-0.06em] text-[#755DD9] md:text-[46px]">
            Frequently Asked Questions
          </h2>

          <div className="mx-auto grid max-w-[1100px] grid-cols-1 gap-4 md:grid-cols-2">
            {faqItems.map(({ question, answer }, index) => (
              <div
                key={question}
                className={`rounded-[14px] bg-[#1E1A24] p-5 text-white shadow-[0_8px_18px_rgba(17,13,26,0.08)] ${answer ? 'min-h-[120px]' : 'min-h-[84px]'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-[15px] font-bold leading-[1.45] tracking-[-0.02em] text-white md:text-[18px]">
                      {question}
                    </p>
                    {answer && (
                      <p className="mt-2 text-[13px] leading-[1.6] text-white/80 md:text-[14px]">
                        {answer}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer
        id="contact"
        className="w-full text-white"
        style={{ background: 'linear-gradient(90deg, #532977 0%, #9A4CDD 100%)' }}
      >
        <div className="mx-auto max-w-[1200px] px-4 py-16 md:px-6 lg:px-8">
          <div className="grid gap-10 md:grid-cols-5">
            <div className="md:col-span-2">
              <div className="mb-5 inline-flex items-center justify-center">
                <Image src="/images/logo.png" alt="Vmeet" width={120} height={32} />
              </div>
              <p className="max-w-[320px] text-[15px] leading-[1.7] text-white/70">
                V-Meet helps universities, lecturers and students track attendance, engagement and learning outcomes from a single platform.
              </p>
              <div className="mt-6 flex items-center gap-3">
                {[ 'f', 'in', 'x' ].map((label) => (
                  <a
                    key={label}
                    href="#"
                    aria-label={`Visit ${label} social profile`}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-[12px] font-bold text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    {label}
                  </a>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-[14px] font-bold uppercase tracking-[0.12em] text-white/60">Product</h4>
              <ul className="mt-4 space-y-3 text-[15px] text-white/80">
                <li><a href="#features" className="transition-colors hover:text-white">Features</a></li>
                <li><a href="#platform" className="transition-colors hover:text-white">Platform</a></li>
                <li><a href="#solutions" className="transition-colors hover:text-white">Solutions</a></li>
                <li><a href="#how-it-works" className="transition-colors hover:text-white">How it works</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-[14px] font-bold uppercase tracking-[0.12em] text-white/60">Resources</h4>
              <ul className="mt-4 space-y-3 text-[15px] text-white/80">
                <li><a href="#faq" className="transition-colors hover:text-white">FAQ</a></li>
                <li><a href="#" className="transition-colors hover:text-white">Documentation</a></li>
                <li><a href="#" className="transition-colors hover:text-white">Help center</a></li>
                <li><a href="#" className="transition-colors hover:text-white">Privacy</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-[14px] font-bold uppercase tracking-[0.12em] text-white/60">Company</h4>
              <ul className="mt-4 space-y-3 text-[15px] text-white/80">
                <li><a href="#" className="transition-colors hover:text-white">About us</a></li>
                <li><a href="#" className="transition-colors hover:text-white">Careers</a></li>
                <li><a href="#" className="transition-colors hover:text-white">Contact</a></li>
                <li><a href="#" className="transition-colors hover:text-white">Blog</a></li>
              </ul>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-4 border-t border-white/10 pt-6 text-[14px] text-white/60 md:flex-row md:items-center md:justify-between">
            <p>© 2025 V-Meet. All rights reserved.</p>
            <div className="flex flex-wrap items-center gap-5">
              <a href="#" className="transition-colors hover:text-white">Privacy Policy</a>
              <a href="#" className="transition-colors hover:text-white">Terms of Service</a>
              <a href="#contact" className="transition-colors hover:text-white">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}
