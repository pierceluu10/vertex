"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Navbar } from "@/components/landing/navbar";
import { HeroShapes } from "@/components/landing/hero-shapes";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-violet-50/40 to-violet-100/30 overflow-hidden relative">
      {/* Subtle background gradient wash */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--color-violet-100)_0%,_transparent_50%)] opacity-60" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--color-pink-200)_0%,_transparent_40%)] opacity-30" />

      <div className="relative">
        <Navbar />

        {/* Hero Section */}
        <section className="px-8 md:px-16 pt-8 md:pt-16 pb-16 md:pb-24">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            {/* Left: Text Content */}
            <motion.div
              className="z-10 max-w-xl"
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
            >
              <h1 className="text-4xl md:text-5xl lg:text-[3.5rem] font-bold leading-[1.1] tracking-tight text-foreground">
                Learning powered by the people who{" "}
                <span className="text-violet-600">love them</span> most
              </h1>

              <p className="mt-5 text-base md:text-lg text-muted-foreground leading-relaxed max-w-md">
                AI tutoring with your voice and presence. Your child stays
                focused, supported, and learning — with you right there, even
                when you can&apos;t be.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link
                  href="/signup"
                  className={buttonVariants({
                    size: "lg",
                    className:
                      "bg-violet-600 hover:bg-violet-700 text-white rounded-full px-8 shadow-lg shadow-violet-500/25 text-base",
                  })}
                >
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
                <Link
                  href="#how-it-works"
                  className={buttonVariants({
                    variant: "outline",
                    size: "lg",
                    className:
                      "rounded-full px-8 border-violet-200 text-violet-700 hover:bg-violet-50 text-base",
                  })}
                >
                  Learn More
                </Link>
              </div>

              {/* Social proof */}
              <motion.div
                className="mt-12 flex items-center gap-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8, duration: 0.5 }}
              >
                <div className="flex -space-x-2">
                  {[
                    "bg-violet-400",
                    "bg-pink-400",
                    "bg-violet-300",
                    "bg-pink-300",
                  ].map((color, i) => (
                    <div
                      key={i}
                      className={`w-8 h-8 rounded-full ${color} border-2 border-white flex items-center justify-center text-[10px] text-white font-bold`}
                    >
                      {["P", "M", "D", "S"][i]}
                    </div>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  Trusted by{" "}
                  <span className="font-semibold text-foreground">500+</span>{" "}
                  families
                </p>
              </motion.div>
            </motion.div>

            {/* Right: 3D Shapes */}
            <motion.div
              className="relative hidden lg:block"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.3 }}
            >
              <HeroShapes />
            </motion.div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="px-8 md:px-16 py-20 relative z-10">
          <div className="max-w-6xl mx-auto">
            <motion.div
              className="text-center mb-16"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                Built for how kids{" "}
                <span className="text-violet-600">actually</span> learn
              </h2>
              <p className="mt-4 text-muted-foreground max-w-lg mx-auto">
                Every feature is designed around attention, encouragement, and
                real understanding.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  icon: (
                    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  ),
                  title: "Parent Avatar Tutor",
                  description:
                    "Your child sees and hears you as their tutor. Familiar, safe, and motivating.",
                },
                {
                  icon: (
                    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v6l4 2" />
                    </svg>
                  ),
                  title: "Focus Detection",
                  description:
                    "Notices when attention drifts and gently brings your child back on track.",
                },
                {
                  icon: (
                    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                  ),
                  title: "Homework-Grounded",
                  description:
                    "Upload any worksheet or PDF. Answers are based on your child's actual assignment.",
                },
                {
                  icon: (
                    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                    </svg>
                  ),
                  title: "Adaptive Difficulty",
                  description:
                    "Automatically adjusts to your child's pace. Simplifies when they struggle, challenges when they're ready.",
                },
                {
                  icon: (
                    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                      <line x1="8" y1="21" x2="16" y2="21" />
                      <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                  ),
                  title: "Interactive Visuals",
                  description:
                    "Number lines, shapes, and graphs that make abstract math concrete and clickable.",
                },
                {
                  icon: (
                    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                  ),
                  title: "Parent Reports",
                  description:
                    "Get a clear summary of what was studied, where they struggled, and what to practice next.",
                },
              ].map((feature, i) => (
                <motion.div
                  key={feature.title}
                  className="p-6 rounded-2xl bg-white/70 backdrop-blur-sm border border-violet-100/50 hover:border-violet-200 hover:shadow-lg hover:shadow-violet-100/50 transition-all duration-300"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                >
                  <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center text-violet-600 mb-4">
                    {feature.icon}
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section
          id="how-it-works"
          className="px-8 md:px-16 py-20 bg-gradient-to-b from-transparent to-violet-50/50 relative z-10"
        >
          <div className="max-w-4xl mx-auto">
            <motion.div
              className="text-center mb-16"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                Three steps to{" "}
                <span className="text-violet-600">personalized</span> learning
              </h2>
            </motion.div>

            <div className="space-y-12">
              {[
                {
                  step: "01",
                  title: "Set up your profile",
                  description:
                    "Create your account, add your child's details, and record a short video for your parent avatar.",
                },
                {
                  step: "02",
                  title: "Upload homework",
                  description:
                    "Take a photo or upload a PDF of your child's worksheet. The AI reads and understands it.",
                },
                {
                  step: "03",
                  title: "Start learning",
                  description:
                    "Your child opens their session. You're right there in the corner — guiding, encouraging, and keeping them on track.",
                },
              ].map((item, i) => (
                <motion.div
                  key={item.step}
                  className="flex gap-6 items-start"
                  initial={{ opacity: 0, x: -30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15 }}
                >
                  <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-violet-600 text-white flex items-center justify-center font-bold text-lg shadow-lg shadow-violet-500/25">
                    {item.step}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-1">{item.title}</h3>
                    <p className="text-muted-foreground">{item.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <motion.div
              className="text-center mt-16"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 }}
            >
              <Link
                href="/signup"
                className={buttonVariants({
                  size: "lg",
                  className:
                    "bg-violet-600 hover:bg-violet-700 text-white rounded-full px-10 shadow-lg shadow-violet-500/25 text-base",
                })}
              >
                Start Your Free Trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </motion.div>
          </div>
        </section>

        {/* Footer */}
        <footer className="px-8 md:px-16 py-10 border-t border-violet-100/50 relative z-10">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-violet-800 flex items-center justify-center">
                <svg
                  viewBox="0 0 24 24"
                  className="w-4 h-4 text-white"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 3L2 20h20L12 3z" />
                </svg>
              </div>
              <span className="font-semibold text-foreground">Vertex</span>
            </div>

            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} Vertex. Built with care for
              young learners.
            </p>

            <div className="flex gap-3">
              {["M5 12h14", "M12 5v14"].map((d, i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-full bg-violet-100 hover:bg-violet-200 transition-colors flex items-center justify-center cursor-pointer"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-4 h-4 text-violet-600"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path d={d} />
                  </svg>
                </div>
              ))}
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
