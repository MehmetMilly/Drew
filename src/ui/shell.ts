// DOM shell over the page (look-and-feel §8): title, chapter spread with sticky-note
// level cards, the in-play HUD (title label, retry, back) and the end card.
// Laid out in page units (720 × 1280) and scaled with the page.
import type { Toy } from '../game/toy';
import type { LevelDef } from '../sim/level';
import { CHAPTERS, ALL_LEVELS } from '../levels';
import { load as loadSave, save } from '../game/save';
import { pencilTick } from '../audio/pencil';

type Screen = 'title' | 'chapter' | 'play' | 'toy' | 'settings';

const el = (tag: string, cls = '', html = '') => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};

export class Shell {
  private root = el('div', 'ui');
  private screen: Screen = 'title';
  private card: HTMLElement | null = null;

  constructor(private toy: Toy) {
    document.body.appendChild(this.root);
    this.fit();
    addEventListener('resize', () => requestAnimationFrame(() => this.fit()));
    toy.onWin = (info) => this.endCard(info);
    toy.onRetry = () => this.retry();
    addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && (this.screen === 'play' || this.screen === 'toy')) this.show(this.screen === 'play' ? 'chapter' : 'title');
    });
    this.show('title');
  }

  /** The layer sits exactly on the page and scales with it. */
  private fit() {
    const r = this.toy.rect;
    this.root.style.transform = `translate(${r.x}px, ${r.y}px) scale(${r.scale})`;
  }

  private press(b: HTMLElement, fn: () => void) {
    b.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      pencilTick();
    });
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      fn();
    });
    return b;
  }

  show(s: Screen, level?: LevelDef) {
    this.screen = s;
    this.root.innerHTML = '';
    this.card = null;
    this.root.className = 'ui ' + s;
    this.toy.quiet = s !== 'play' && s !== 'toy';
    if (s === 'title') this.title();
    else if (s === 'chapter') this.chapter();
    else if (s === 'settings') this.settings();
    else if (s === 'toy') {
      this.toy.load(null);
      this.hud(null);
    } else if (s === 'play' && level) {
      this.toy.load(level);
      this.hud(level);
    }
    this.fit();
  }

  private title() {
    // the page behind is the live blank toy: the title sits on it
    this.toy.load(null);
    const t = el('div', 'logo', 'Drew');
    this.root.append(t);
    const notes = el('div', 'notes');
    const story = this.press(el('button', 'note n1', '<b>Story</b><small>Little Guy needs a friend</small>'), () => this.show('chapter'));
    const pad = this.press(el('button', 'note n2', '<b>Doodle Pad</b><small>draw anything</small>'), () => this.show('toy'));
    const sumo = el('button', 'note n3 locked', '<b>Sumo</b><small>after Chapter 1</small>');
    const set = this.press(el('button', 'tab', 'settings'), () => this.show('settings'));
    notes.append(story, pad, sumo);
    this.root.append(notes, set);
  }

  private chapter() {
    this.toy.load(null);
    const d = loadSave();
    const ch = CHAPTERS[0];
    this.root.append(el('div', 'chapter-title', `Chapter ${ch.id}<br><span>${ch.title}</span>`));
    const grid = el('div', 'levels');
    ch.levels.forEach((lv, i) => {
      const open = i === 0 || d.cleared[ch.levels[i - 1].id] || import.meta.env.DEV;
      const badges = d.badges[lv.id] ?? [];
      const slots = [0, 1, 2].map((k) => `<i class="slot ${badges[k] ? 'on' : ''}" title="${badges[k] ? 'the ' + badges[k] : ''}"></i>`).join('');
      const b = el('button', `note lvl ${open ? '' : 'locked'} ${d.cleared[lv.id] ? 'done' : ''}`, `<em>${lv.id}</em><b>${lv.title}</b><span class="slots">${slots}</span>`);
      b.style.setProperty('--tilt', `${((i * 37) % 7) - 3}deg`);
      b.style.animationDelay = `${i * 40}ms`;
      if (open) this.press(b, () => this.show('play', lv));
      grid.append(b);
    });
    this.root.append(grid);
    this.root.append(this.press(el('button', 'tab back', '← back'), () => this.show('title')));
  }

  private hud(level: LevelDef | null) {
    const bar = el('div', 'hud');
    if (level) {
      bar.append(this.press(el('button', 'icon retry', '<svg viewBox="0 0 40 40"><path d="M30 14a12 12 0 1 0 2 10" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/><path d="M31 6v9h-9" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'), () => this.retry()));
    }
    bar.append(this.press(el('button', 'icon back', '<svg viewBox="0 0 40 40"><path d="M10 12h20M10 20h20M10 28h20" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/></svg>'), () => this.show(level ? 'chapter' : 'title')));
    this.root.append(bar);
  }

  private retry() {
    if (this.card) {
      this.card.remove();
      this.card = null;
    }
    this.toy.retry();
  }

  private endCard(info: { level: LevelDef; heroes: { name: string; kind: string }[]; newBadges: string[]; epitaph: string }) {
    if (this.screen !== 'play' || this.toy.level?.id !== info.level.id) return;
    const d = loadSave();
    const badges = d.badges[info.level.id] ?? [];
    const c = el('div', 'endcard');
    const names = info.heroes.slice(0, 3).map((h) => `<div class="plate">${h.name}</div>`).join('');
    const slots = [0, 1, 2].map((k) => `<i class="slot ${badges[k] ? 'on' : ''} ${badges[k] && info.newBadges.includes(badges[k]) ? 'new' : ''}"></i>`).join('');
    c.innerHTML = `${names}<p class="epitaph">${info.epitaph}</p><div class="badges">${slots}<small>${badges.length ? 'Cleared with: ' + badges.map((b) => 'the ' + b).join(' · ') : ''}</small></div>`;
    const idx = ALL_LEVELS.findIndex((l) => l.id === info.level.id);
    const next = ALL_LEVELS[idx + 1];
    const row = el('div', 'buttons');
    if (next) row.append(this.press(el('button', 'note small go', 'Next →'), () => this.show('play', next)));
    else row.append(this.press(el('button', 'note small go', 'Chapter done!'), () => this.show('chapter')));
    row.append(this.press(el('button', 'note small', 'Retry'), () => this.retry()));
    c.append(row);
    this.root.append(c);
    this.card = c;
  }

  private settings() {
    this.toy.load(null);
    const d = loadSave();
    const s = d.settings;
    const box = el('div', 'note settings-note');
    box.append(el('b', '', 'Settings'));
    const toggle = (label: string, get: () => boolean, set: (v: boolean) => void) => {
      const row = this.press(el('button', 'toggle ' + (get() ? 'on' : ''), `<i></i>${label}`), () => {
        set(!get());
        row.classList.toggle('on', get());
        save();
      });
      box.append(row);
    };
    toggle('Sound', () => s.sound > 0, (v) => (s.sound = v ? 1 : 0));
    toggle('Gentle mode (slower, more ink)', () => s.gentle, (v) => (s.gentle = v));
    toggle('Intent lines', () => s.intentLines, (v) => (s.intentLines = v));
    toggle('Reduced motion', () => s.reducedMotion, (v) => (s.reducedMotion = v));
    toggle('Haptics', () => s.haptics, (v) => (s.haptics = v));
    this.root.append(box);
    this.root.append(this.press(el('button', 'tab back', '← back'), () => this.show('title')));
  }
}
