"use client";
import React from "react";

export function Button({ className="", variant="primary", size="md", ...props }: any){
  const base="inline-flex items-center justify-center rounded-xl font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";
  const variants:any={
    primary:"bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-600 shadow-sm",
    secondary:"bg-white border border-slate-200 text-slate-700 hover:bg-slate-50",
    ghost:"text-slate-600 hover:bg-slate-100",
    danger:"bg-red-600 text-white hover:bg-red-700",
  };
  const sizes:any={
    sm:"h-8 px-3 text-sm",
    md:"h-10 px-4 text-sm",
    lg:"h-11 px-6 text-base",
    xl:"h-12 px-8 text-base",
  };
  return <button className={`${base} ${variants[variant]||variants.primary} ${sizes[size]||sizes.md} ${className}`} {...props} />
}
export function Input(props:any){
  return <input className={`w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${props.className||""}`} {...props} />
}
export function Textarea(props:any){
  return <textarea className={`w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${props.className||""}`} {...props} />
}
export function Label({children, ...props}:any){
  return <label className="text-sm font-medium text-slate-700 mb-1.5 block" {...props}>{children}</label>
}
export function Card({className="", ...props}:any){
  return <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm ${className}`} {...props} />
}
export function Badge({children, variant="default", className=""}:any){
  const v:any={
    default:"bg-slate-100 text-slate-700",
    success:"bg-emerald-50 text-emerald-700 border border-emerald-200",
    warning:"bg-amber-50 text-amber-700 border border-amber-200",
    info:"bg-indigo-50 text-indigo-700 border border-indigo-200",
    draft:"bg-slate-100 text-slate-600 border border-slate-200",
    published:"bg-emerald-50 text-emerald-700 border border-emerald-200",
    closed:"bg-red-50 text-red-700 border border-red-200",
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${v[variant]||v.default} ${className}`}>{children}</span>
}
