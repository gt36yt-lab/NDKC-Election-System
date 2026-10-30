type OtpStatusProps = {
  status?: "scheduled" | "active" | "ended" | "cancelled";
  otpCode: string | null;
  hasVoted: boolean;
  error?: boolean;
};

export default function OtpStatus({ status, otpCode, hasVoted, error = false }: OtpStatusProps) {
  return (
    <section aria-labelledby="student-otp-title" className="mt-7 border-y border-[#cfd8d1] bg-white/80 px-5 py-5 sm:px-7">
      <p id="student-otp-title" className="text-xs font-bold uppercase tracking-wide text-[#005a36]">Voting OTP</p>
      {hasVoted ? <p className="mt-2 text-sm text-[#66736b]">Your ballot has already been submitted.</p>
        : error ? <p role="alert" className="mt-2 text-sm text-[#8c3328]">Your OTP status could not be verified. Contact the election board.</p>
          : status === "active" && otpCode ? <p className="mt-2 text-sm text-[#193d2b]">Here is your OTP: <strong className="font-mono text-lg tabular-nums tracking-[0.15em]">{otpCode}</strong>, Vote wisely</p>
            : status === "active" ? <p className="mt-2 text-sm text-[#66736b]">Your OTP is not available yet. Contact the election board.</p>
              : <p className="mt-2 text-sm text-[#66736b]">Your OTP is not here yet since voting has not started</p>}
    </section>
  );
}
