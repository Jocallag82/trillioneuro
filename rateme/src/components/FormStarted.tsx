'use client';
import { useEffect, useRef } from 'react';

/** Records when the form was rendered so the server can reject instant bot submissions. */
export function FormStarted() {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.value = String(Date.now()); }, []);
  return <input ref={ref} type="hidden" name="form_started" defaultValue="" />;
}
