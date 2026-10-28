'use client';

import Image from 'next/image';
import { SignIn, useUser } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BACKEND_URL } from '@/constants/config';

export default function SiginInPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [isCheckingAccount, setIsCheckingAccount] = useState(false);

  useEffect(() => {
    if (!isLoaded || !user) return;

    let cancelled = false;

    const checkAccount = async () => {
      setIsCheckingAccount(true);
      try {
        const response = await fetch(`${BACKEND_URL}/check-role-selection`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id }),
        });

        if (!response.ok) {
          throw new Error('Could not verify your account');
        }

        const data = await response.json();
        if (cancelled) return;

        if (data.roleData?.nextStep === 'registration') {
          router.replace('/student-registration');
        } else if (data.role) {
          router.replace('/home');
        } else {
          router.replace('/role-selection');
        }
      } catch (error) {
        console.error('Error verifying signed-in account:', error);
        if (!cancelled) setIsCheckingAccount(false);
      }
    };

    checkAccount();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, user, router]);

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-[#FFFFFF] px-4 pb-10 pt-8 sm:px-8 sm:py-8 lg:px-10 lg:py-5">
      <div className="mx-auto grid min-h-0 w-full max-w-[1120px] items-start gap-8 sm:gap-10 lg:min-h-[calc(100vh-2.5rem)] lg:items-center lg:grid-cols-[0.82fr_1.18fr] lg:gap-12">
        <section className="order-1 flex min-w-0 w-full justify-center overflow-visible">
          <div className="w-full max-w-[390px] min-w-0 px-1 py-2 sm:px-3 sm:py-4">
            {isCheckingAccount ? (
              <div className="flex min-h-40 items-center justify-center" aria-label="Loading">
                <span className="h-10 w-10 animate-spin rounded-full border-4 border-[#E5DDF0] border-t-[#2D155C]" />
              </div>
            ) : (
            <SignIn
              afterSignInUrl="/sign-in"
              redirectUrl="/sign-in"
              path="/sign-in"
              routing="path"
              signUpUrl="/sign-up"
              appearance={{
                variables: {
                  colorPrimary: '#2D155C',
                  colorText: '#15121B',
                  colorTextSecondary: '#15121B',
                  colorBackground: 'transparent',
                  borderRadius: '5px',
                  fontFamily: 'Trebuchet MS, sans-serif',
                },
                elements: {
                  rootBox: 'w-full',
                  card: 'w-full max-w-none border-0 bg-transparent p-0 shadow-none',
                  header: 'mb-9',
                  headerTitle: 'text-center text-[24px] font-bold leading-[1.3] text-[#17121F]',
                  headerSubtitle: 'hidden',
                  socialButtonsBlock: 'hidden',
                  dividerRow: 'hidden',
                  formFieldLabel: 'mb-3 text-[14px] font-semibold leading-tight text-[#15121B]',
                  formFieldInput: 'h-[50px] w-full rounded-[8px] border border-[#81798B] bg-transparent px-4 text-[15px] text-[#15121B] caret-[#15121B] placeholder:text-[#81798B] shadow-none outline-none transition-colors focus:border-[#755DD9] focus:ring-2 focus:ring-[#755DD9]/20 sm:h-[52px]',
                  otpCodeFieldInput: 'h-[44px] w-[44px] rounded-[8px] border border-[#81798B] bg-transparent text-[16px] font-semibold text-[#15121B] caret-[#15121B] shadow-none outline-none focus:border-[#755DD9] focus:ring-2 focus:ring-[#755DD9]/20 sm:h-[50px] sm:w-[50px]',
                  formField: 'mb-5 sm:mb-6',
                  formButtonPrimary: 'mt-1 h-[50px] w-full rounded-[8px] bg-[#2D155C] text-[14px] font-bold shadow-[0_7px_14px_rgba(45,21,92,0.18)] transition-colors hover:bg-[#3B1B73] sm:mt-2 sm:h-[52px]',
                  footer: 'mt-6 border-0 bg-transparent p-0',
                  footerAction: 'text-center',
                  footerActionText: 'text-[12px] leading-[1.4] text-[#111111]',
                  footerActionLink: 'text-[#755DD9] hover:text-[#2D155C]',
                  identityPreview: 'hidden',
                  alert: 'mb-3 text-[11px]',
                },
              }}
            />
            )}
          </div>
        </section>

        <section className="relative order-2 hidden h-[260px] w-full overflow-hidden rounded-[14px] bg-[#EDE7F5] shadow-[0_8px_22px_rgba(45,21,92,0.08)] lg:order-2 lg:block lg:aspect-[0.99/1] lg:h-auto">
          <Image
            src="/images/sigim.png"
            alt="Student studying in a classroom"
            fill
            priority
            sizes="(max-width: 1024px) 90vw, 52vw"
            className="object-cover"
          />
        </section>
      </div>
    </main>
  );
}
