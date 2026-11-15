"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { Course } from "@/data/courses";
import { clock, monthDay, weekday, weekdayShort } from "@/lib/time";
import type { DayWeather } from "@/lib/weather";
import { Conditions } from "./features";
import { Photo, PhotoCredit, type PhotoData } from "./Photo";

export type ExplorerCourse = {
  id: string; title: string; date: string; time: string | null;
  photo: PhotoData; slot: string; href: string; course: Course | null; weather?: DayWeather;
};

export function CourseExplorer({ courses, heading }: { courses: ExplorerCourse[]; heading: string }) {
  const [selected, setSelected] = useState(0);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const item = courses[selected];
  if (!item) return null;
  const choose = (index: number, focus = false) => {
    setSelected(index);
    const tab = document.getElementById(`course-tab-${courses[index].id}`);
    if (focus) tab?.focus({ preventScroll: true });
    if (tab?.parentElement) {
      const parent = tab.parentElement;
      const bounds = parent.getBoundingClientRect(), item = tab.getBoundingClientRect();
      const shift = item.left < bounds.left ? item.left - bounds.left : item.right > bounds.right ? item.right - bounds.right : 0;
      parent.scrollBy({ left: shift, behavior: "instant" });
    }
  };
  return (
    <section aria-labelledby="courses" className="course-explorer">
      <div className="section-heading"><h2 id="courses" className="display">{heading}</h2><p>{courses.length} {courses.length === 1 ? "round" : "rounds"}, in playing order</p></div>
      <div className="course-tabs" role="tablist" aria-label="Explore the courses">
        {courses.map((c, index) => <button key={c.id} type="button" role="tab" id={`course-tab-${c.id}`} aria-controls="course-explorer-panel" aria-selected={selected === index} tabIndex={selected === index ? 0 : -1} onClick={() => choose(index)} onKeyDown={e => {
          const next = e.key === "ArrowRight" ? (index + 1) % courses.length : e.key === "ArrowLeft" ? (index + courses.length - 1) % courses.length : e.key === "Home" ? 0 : e.key === "End" ? courses.length - 1 : -1;
          if (next >= 0) { e.preventDefault(); choose(next, true); }
        }}>
          <span className="course-tab-photo"><Photo photo={c.photo} slot={c.slot} sizes="72px" /></span>
          <span><span className="course-tab-date">{weekdayShort(c.date)} {Number(c.date.slice(8))} <span>Round {index + 1}</span></span><strong>{c.title}</strong></span>
        </button>)}
      </div>
      <div id="course-explorer-panel" role="tabpanel" aria-labelledby={`course-tab-${item.id}`} tabIndex={0} className="course-explorer-panel">
        <div className="course-explorer-photo" onTouchStart={e => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }} onTouchEnd={e => {
          if (!touch.current) return;
          const dx = e.changedTouches[0].clientX - touch.current.x, dy = e.changedTouches[0].clientY - touch.current.y;
          touch.current = null;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) choose(Math.max(0, Math.min(courses.length - 1, selected + (dx < 0 ? 1 : -1))));
        }} onTouchCancel={() => { touch.current = null; }}>
          {courses.map((c, index) => <div key={c.id} className="course-photo-layer" aria-hidden={index !== selected} data-active={index === selected}><Photo photo={c.photo} slot={c.slot} alt={c.title} sizes="(min-width: 1024px) 65vw, 100vw" /></div>)}
          <PhotoCredit photo={item.photo} className="absolute bottom-4 left-5" />
          <span className="course-photo-count figures">{selected + 1} / {courses.length}</span>
          <div className="course-photo-controls"><button type="button" aria-label="Previous course" disabled={selected === 0} onClick={() => choose(selected - 1)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m14 5-7 7 7 7" /></svg></button><button type="button" aria-label="Next course" disabled={selected === courses.length - 1} onClick={() => choose(selected + 1)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m10 5 7 7-7 7" /></svg></button></div>
        </div>
        <div className="course-explorer-details">{courses.map((item, index) => <div className="course-explorer-detail" key={item.id} data-active={index === selected} aria-hidden={index !== selected} inert={index !== selected}>
          <h3 className="display">{item.title}</h3>
          {item.course && <p className="course-explorer-designer">{item.course.designer} · {item.course.opened}</p>}
          {item.course && <p className="course-explorer-intro serif">{item.course.expect[0]}</p>}
          <dl className="course-explorer-facts">
            <div><dt>Your round</dt><dd>{weekday(item.date)}, {monthDay(item.date)}</dd></div>
            <div><dt>Tee time</dt><dd>{item.time ? clock(item.time) : "To come"}</dd></div>
            {item.course && <div><dt>The card</dt><dd>Par {item.course.par} · {item.course.yards.toLocaleString("en-US")} yards</dd></div>}
          </dl>
          {item.weather && <Conditions weather={item.weather} grid className="mt-5" />}
          <Link href={item.href} className="course-explorer-link">Explore the course <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" /></svg></Link>
        </div>)}</div>
      </div>
    </section>
  );
}
