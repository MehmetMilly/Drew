// DOM shell over the page (look-and-feel §8): title, chapter spread with sticky-note
// level cards, the in-play HUD (title label, retry, back) and the end card.
// Laid out in page units (720 × 1280) and scaled with the page.
import { Toy } from '../game/toy';
import type { LevelDef } from '../sim/level';
import { CHAPTERS, ALL_LEVELS } from '../levels';
import { load as loadSave, save, type Hero } from '../game/save';
import { hallCanvas, PER_PAGE } from './hall';
import { OPPONENTS, RING, sumoLevel } from '../levels/sumo';
import { WORLD } from '../tuning';

const WORLD_W = WORLD.W;
const VERSUS_DRAW = 8; // s each player has to draw
import { dailyFor, dateKey } from '../levels/daily';
import { PENCILS, setPencil } from '../render/pencils';
import { dropHazard, setLowGravity, setWater, setWind, type Drop } from '../sim/doodle';
import type { World } from '../sim/world';
import { levelThumb } from './thumb';
import { pencilTick } from '../audio/pencil';
import { sfxCountdown, sfxUi } from '../audio/sfx';

type Screen = 'title' | 'chapter' | 'sumo' | 'daily' | 'doodle' | 'play' | 'toy' | 'settings' | 'sketchbook' | 'hero' | 'credits';

/** Progression (design §13): a chapter opens when 4 of the one before are cleared; inside it,
 *  levels open one by one; the finale (a boss) needs every other level of its chapter. */
function levelOpen(lv: LevelDef, cleared: Record<string, boolean>): boolean {
  const ci = CHAPTERS.findIndex((c) => c.levels.includes(lv));
  if (ci < 0) return true;
  if (ci > 0 && CHAPTERS[ci - 1].levels.filter((l) => cleared[l.id]).length < 4) return false;
  const levels = CHAPTERS[ci].levels;
  const i = levels.indexOf(lv);
  if (lv.goal.type === 'boss') return levels.every((l) => l === lv || cleared[l.id]);
  return i === 0 || !!cleared[levels[i - 1].id];
}

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
  private chapterIdx = 0;
  private stopHall: (() => void) | null = null;
  private hallPage = 0;
  private sumoPage = 0;
  /** Sumo pass-and-play (design §12): best of five, alternating who draws first. */
  private vs: { on: boolean; round: number; score: [number, number]; timer: number } = { on: false, round: 0, score: [0, 0], timer: 0 };

  constructor(private toy: Toy) {
    document.body.appendChild(this.root);
    this.fit();
    addEventListener('resize', () => requestAnimationFrame(() => this.fit()));
    toy.onWin = (info) => this.endCard(info);
    toy.onRetry = () => this.retry();
    toy.onFail = () => this.failWatch();
    toy.onWatchEnd = () => {
      if (this.card) this.card.style.display = '';
      else if (this.toy.level) this.failWatch();
    };
    addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && (this.screen === 'play' || this.screen === 'toy' || this.screen === 'hero')) this.show(this.screen === 'play' ? this.home(this.toy.level) : 'sketchbook');
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

  show(s: Screen, level?: LevelDef, hero?: Hero) {
    if (s !== 'play') {
      this.vs.on = false;
      clearInterval(this.vs.timer);
    }
    if (s !== this.screen) sfxUi('page'); // moving between screens turns a page
    this.stopHall?.();
    this.stopHall = null;
    // the chapter screen opens on the chapter of the level just played
    if (level) this.chapterIdx = Math.max(0, CHAPTERS.findIndex((c) => c.levels.includes(level)));
    this.screen = s;
    this.root.innerHTML = '';
    this.card = null;
    this.root.className = 'ui ' + s + (loadSave().settings.leftHanded ? ' lefty' : '');
    this.toy.quiet = s !== 'play' && s !== 'toy';
    if (s === 'title') this.title();
    else if (s === 'chapter') this.chapter();
    else if (s === 'sumo') this.sumo();
    else if (s === 'daily') this.daily();
    else if (s === 'doodle') this.doodle();
    else if (s === 'settings') this.settings();
    else if (s === 'sketchbook') this.sketchbook();
    else if (s === 'credits') this.credits();
    else if (s === 'hero' && hero) {
      this.toy.load(null);
      this.toy.adopt(hero.strokes, hero.name);
      this.hud(null, 'sketchbook');
      const tag = el('div', 'hero-tag', `<b>${hero.name}</b>${hero.epitaph ? `<small>${hero.epitaph}</small>` : ''}<small>${hero.level} · ${new Date(hero.at).toLocaleDateString()}</small>`);
      this.root.append(tag);
    }
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
    const d = loadSave();
    const ch1 = CHAPTERS[0].levels.every((l) => d.cleared[l.id]);
    this.root.append(this.logo());
    const notes = el('div', 'notes');
    const story = this.press(el('button', 'note n1', '<b>Story</b><small>Little Guy needs a friend</small>'), () => this.show('chapter'));
    const sumoOpen = ch1 || import.meta.env.DEV;
    const sumo = el('button', `note n2 ${sumoOpen ? '' : 'locked'}`, `<b>Sumo</b><small>${sumoOpen ? 'shove them off the ring' : 'after Chapter 1'}</small>`);
    if (sumoOpen) this.press(sumo, () => this.show('sumo'));
    const daily = el('button', `note n3 ${sumoOpen ? '' : 'locked'}`, `<b>Daily</b><small>${sumoOpen ? dailyFor(dateKey()).mod.name : 'after Chapter 1'}</small>`);
    if (sumoOpen) this.press(daily, () => this.show('daily'));
    notes.append(story, sumo, daily);
    const book = this.press(el('button', 'tab sketch', 'Sketchbook'), () => this.show('sketchbook'));
    const set = this.press(el('button', 'tab', 'settings'), () => this.show('settings'));
    this.root.append(notes, book, set, this.littleGuy());
  }

  /** Little Guy on the title, by the floor, waving, scarf in highlighter. */
  private littleGuy() {
    return el(
      'div',
      'title-guy',
      `<svg viewBox="0 0 60 90"><g fill="none" stroke="#1B1B1F" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 86l8-24 8 24M30 62V38M30 44l-10 12"/><path class="wave" d="M30 44l11-12"/></g>
        <circle cx="30" cy="27" r="10" fill="#1B1B1F"/><circle cx="26.5" cy="26" r="1.8" fill="#FFFDF6"/><circle cx="33" cy="26" r="1.8" fill="#FFFDF6"/>
        <path d="M23 39c5 1 10 1 15-1l9 4" stroke="#F2C230" stroke-width="5" stroke-linecap="round" fill="none"/></svg>`,
    );
  }

  /** The logo writes itself, then the D wakes up: its eyes open and follow you. */
  private logo() {
    const t = el('div', 'logo', '<span class="ink">Drew<i class="eyes"><i class="eye"><i></i></i><i class="eye"><i></i></i></i></span>');
    const eyes = t.querySelector('.eyes') as HTMLElement;
    const look = (e: PointerEvent) => {
      const r = eyes.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2),
        dy = e.clientY - (r.top + r.height / 2);
      const k = Math.min(1, Math.hypot(dx, dy) / 200) / (Math.hypot(dx, dy) || 1);
      eyes.style.setProperty('--lx', `${dx * k * 5}px`);
      eyes.style.setProperty('--ly', `${dy * k * 5}px`);
    };
    addEventListener('pointermove', look);
    addEventListener('pointerdown', look);
    return t;
  }

  /** The credits (levels.md §5 finale): drawn by hand, rolling up over every hero the
   *  player made, all waving from the Hall of Heroes. */
  private credits() {
    this.toy.load(null);
    const hall = loadSave().hall.slice(-PER_PAGE);
    if (hall.length) {
      const { el: c, stop } = hallCanvas(hall, () => {});
      this.stopHall = stop;
      c.classList.add('waving');
      this.root.append(c);
    }
    const roll = el(
      'div',
      'credits-roll',
      `<h1>The End</h1><p>Little Guy is safe.</p><p>Starring</p><p class="big">${hall.length ? 'all your heroes' : 'you'}</p>` +
        `<p>Drawn by</p><p class="big">you</p><p>Everything else</p><p class="big">a pencil and a lot of physics</p><p>Thanks for drawing.</p>`,
    );
    this.root.append(roll);
    this.root.append(this.press(el('button', 'tab back', '← back'), () => this.show('title')));
  }

  private sketchbook() {
    this.toy.load(null);
    const hall = loadSave().hall;
    this.root.append(el('div', 'chapter-title', `Sketchbook<br><span>Hall of Heroes</span>`));
    if (!hall.length) this.root.append(el('div', 'empty', 'Win a level and its hero lives here.'));
    else {
      const pages = Math.ceil(hall.length / PER_PAGE);
      this.hallPage = Math.min(this.hallPage, pages - 1);
      const { el: c, stop } = hallCanvas(hall.slice(this.hallPage * PER_PAGE, (this.hallPage + 1) * PER_PAGE), (h) => this.show('hero', undefined, h));
      this.stopHall = stop;
      this.root.append(c);
      if (pages > 1) {
        const nav = el('div', 'pager');
        nav.append(
          this.press(el('button', 'tab', '‹'), () => {
            this.hallPage = (this.hallPage + pages - 1) % pages;
            this.show('sketchbook');
          }),
          el('span', '', `${this.hallPage + 1} / ${pages}`),
          this.press(el('button', 'tab', '›'), () => {
            this.hallPage = (this.hallPage + 1) % pages;
            this.show('sketchbook');
          }),
        );
        this.root.append(nav);
      }
    }
    this.root.append(this.pencilCase());
    if (loadSave().cleared['1-5'] || import.meta.env.DEV) this.root.append(this.press(el('button', 'note doodle-note', '<b>Doodle Pad</b><small>drop in anything</small>'), () => this.show('doodle')));
    this.root.append(this.press(el('button', 'note blank', '<b>Blank page</b><small>draw anything</small>'), () => this.show('toy')));
    this.root.append(this.press(el('button', 'tab back', '← back'), () => this.show('title')));
  }

  private chapter() {
    this.toy.load(null);
    const d = loadSave();
    const ch = CHAPTERS[this.chapterIdx];
    this.root.append(el('div', 'chapter-title', `Chapter ${ch.id}<br><span>${ch.title}</span>`));
    const grid = el('div', 'levels');
    ch.levels.forEach((lv, i) => {
      // levels open one by one, across chapters (the first of a chapter needs the last of the one before)
      const open = levelOpen(lv, d.cleared) || import.meta.env.DEV;
      const badges = d.badges[lv.id] ?? [];
      const slots = [0, 1, 2].map((k) => `<i class="slot ${badges[k] ? 'on' : ''}" title="${badges[k] ? 'the ' + badges[k] : ''}"></i>`).join('');
      const b = el('button', `note lvl ${open ? '' : 'locked'} ${d.cleared[lv.id] ? 'done' : ''}`, `<em>${lv.id}</em><b>${lv.title}</b><span class="slots">${slots}</span>`);
      b.insertBefore(levelThumb(lv), b.querySelector('.slots'));
      b.style.setProperty('--tilt', `${((i * 37) % 7) - 3}deg`);
      b.style.animationDelay = `${i * 40}ms`;
      if (open) this.press(b, () => this.show('play', lv));
      grid.append(b);
    });
    this.root.append(grid);
    if (CHAPTERS.length > 1) {
      const nav = el('div', 'pager chapters');
      const go = (k: number) => () => {
        this.chapterIdx = (this.chapterIdx + k + CHAPTERS.length) % CHAPTERS.length;
        this.show('chapter');
      };
      nav.append(this.press(el('button', 'tab', '‹'), go(-1)), el('span', '', `chapter ${ch.id} of ${CHAPTERS.length}`), this.press(el('button', 'tab', '›'), go(1)));
      this.root.append(nav);
    }
    this.root.append(this.press(el('button', 'tab back', '← back'), () => this.show('title')));
  }

  /** Where a level returns to: the Sumo ladder or its chapter. */
  private home(level: LevelDef | null): Screen {
    return level?.goal.type === 'sumo' ? 'sumo' : level?.mod ? 'daily' : level?.goal.type === 'free' ? 'sketchbook' : 'chapter';
  }

  /** One pass-and-play round: the first drawer draws (their creature sleeps on the far side
   *  of the ring), then the second drawer draws a counter, and both wake. */
  private versusRound() {
    const first = this.vs.round % 2;
    const second = 1 - first;
    const lv = (foe: { x: number; y: number }[][]): LevelDef => ({ ...sumoLevel(0), id: `versus-${this.vs.round}-${foe.length ? 'b' : 'a'}`, title: `Round ${this.vs.round + 1}`, hint: undefined, casual: true, goal: { type: 'sumo', seconds: 12, ring: RING, foe, name: `Player ${first + 1}` } });
    this.show('play', lv([]));
    this.vs.on = true;
    this.drawTimer(`Player ${first + 1}, draw!`, () => this.toy.dryNow());
    this.toy.capture = (strokes) => {
      clearInterval(this.vs.timer);
      // the first creature stands on the far side of the ring, facing the second drawer
      const foe = strokes.map((st) => st.map((p) => ({ x: WORLD_W - p.x, y: p.y })));
      this.show('play', lv(foe));
      this.vs.on = true;
      this.drawTimer(`Player ${second + 1}, draw!`, () => {
        const drew = this.toy.drewAnything;
        this.toy.dryNow();
        if (!drew) this.versusResult(false); // nothing drawn: the first creature has the ring
      });
    };
  }

  /** The 8 s pencil timer for pass-and-play, shown as a banner. */
  private drawTimer(text: string, done: () => void) {
    this.root.querySelector('.vs-banner')?.remove();
    const b = el('div', 'vs-banner', '');
    this.root.append(b);
    let left = VERSUS_DRAW;
    const tick = () => {
      b.innerHTML = `${text} <b>${left}</b>`;
      if (left >= 1 && left <= 3) sfxCountdown(left); // the last three seconds tick, rising
      if (left-- <= 0) {
        clearInterval(this.vs.timer);
        b.remove();
        done();
      }
    };
    clearInterval(this.vs.timer);
    tick();
    this.vs.timer = window.setInterval(tick, 1000);
  }

  /** A round is over: the second drawer won it if the first creature went off the ring. */
  private versusResult(secondWon: boolean) {
    if (this.card) return;
    const first = this.vs.round % 2;
    const winner = secondWon ? 1 - first : first;
    this.vs.score[winner]++;
    this.vs.round++;
    const [a, b] = this.vs.score;
    const done = a >= 3 || b >= 3;
    const c = el('div', 'endcard', `<div class="plate">${done ? `Player ${winner + 1} wins!` : `Player ${winner + 1} takes it`}</div><p class="epitaph">Player 1 &nbsp;${a} – ${b}&nbsp; Player 2</p>`);
    const row = el('div', 'buttons');
    if (done) {
      row.append(this.press(el('button', 'note small go', 'Again'), () => {
        this.vs = { on: true, round: 0, score: [0, 0], timer: 0 };
        this.versusRound();
      }));
    } else row.append(this.press(el('button', 'note small go', 'Next round →'), () => this.versusRound()));
    row.append(this.press(el('button', 'note small', 'Done'), () => this.show('sumo')));
    c.append(row);
    this.root.append(c);
    this.card = c;
  }

  /** The Pencil Case (design §12): pencils open with badges (and one with the Sumo ladder);
   *  tapping an open one picks it. */
  private pencilCase() {
    const d = loadSave();
    const badges = Object.values(d.badges).reduce((n, b) => n + b.length, 0);
    const ladder = OPPONENTS.every((_, k) => d.cleared['sumo-' + (k + 1)]);
    const box = el('div', 'pencil-case');
    for (const p of PENCILS) {
      const open = (p.unlock.badges ?? 0) <= badges && (!p.unlock.sumo || ladder);
      const swatch = p.color === 'rainbow' ? 'linear-gradient(90deg,#d64545,#e0a030,#4caf50,#3f7fd6,#9b59b6)' : p.color;
      const b = el('button', `pencil ${open ? '' : 'locked'} ${d.settings.pencil === p.id ? 'on' : ''}`, `<i style="background:${swatch}"></i><small>${open ? p.name : p.unlock.sumo ? 'beat the ladder' : `${p.unlock.badges} badges`}</small>`);
      if (open)
        this.press(b, () => {
          d.settings.pencil = p.id;
          save();
          setPencil(p.id);
          this.show('sketchbook');
        });
      box.append(b);
    }
    return box;
  }

  /** The Doodle Pad: Little Guy on a blank page, infinite ink, a palette that drops in any
   *  hazard, and switches for water, wind and moon gravity. */
  private doodle() {
    const lv: LevelDef = { id: 'doodle', title: 'Doodle Pad', paper: 'cream', goal: { type: 'free' }, draw: 0.1, ink: 1e9, terrain: [], entities: [], guy: { x: 360, y: WORLD.floorY }, anatomyMatters: false, refs: [], casual: true };
    this.toy.load(lv);
    this.hud(lv, 'sketchbook');
    const pal = el('div', 'palette');
    const drops: [Drop, string][] = [['boulder', 'Boulder'], ['bomb', 'Bomb'], ['ball', 'Ball'], ['sumo', 'Sumo'], ['ninja', 'Ninja'], ['smudger', 'Smudger'], ['scissors', 'Scissors']];
    for (const [k, name] of drops) pal.append(this.press(el('button', 'chip', name), () => dropHazard(this.toy.world, k)));
    const toggles: [string, (w: World, on: boolean) => void][] = [['Water', setWater], ['Wind', setWind], ['Moon', setLowGravity]];
    for (const [name, fn] of toggles) {
      const b = el('button', 'chip switch', name);
      this.press(b, () => {
        const on = !b.classList.contains('on');
        b.classList.toggle('on', on);
        fn(this.toy.world, on);
      });
      pal.append(b);
    }
    this.root.append(pal);
  }

  /** Daily Doodle: today's arena and modifier, a calendar page of stamps, the streak. */
  private daily() {
    this.toy.load(null);
    const d = loadSave();
    const today = new Date();
    const key = dateKey(today);
    const day = dailyFor(key);
    this.root.append(el('div', 'chapter-title', `Daily Doodle<br><span>${day.arena}</span>`));
    const card = el('button', `note daily-card ${d.cleared[day.level.id] ? 'done' : ''}`, `<em>${key}</em><b>${day.mod.name}</b>`);
    card.insertBefore(levelThumb(day.level), null);
    this.press(card, () => this.show('play', day.level));
    this.root.append(card);
    // the calendar: this month, a stamp on every day cleared
    const y = today.getFullYear(),
      m = today.getMonth();
    const first = new Date(y, m, 1).getDay();
    const days = new Date(y, m + 1, 0).getDate();
    const cal = el('div', 'calendar');
    for (const w of ['S', 'M', 'T', 'W', 'T', 'F', 'S']) cal.append(el('i', 'dow', w));
    for (let k = 0; k < first; k++) cal.append(el('i', 'blank'));
    for (let k = 1; k <= days; k++) {
      const dk = dateKey(new Date(y, m, k));
      cal.append(el('i', `day ${d.cleared['daily-' + dk] ? 'stamped' : ''} ${k === today.getDate() ? 'today' : ''}`, String(k)));
    }
    this.root.append(cal);
    let streak = 0;
    for (let t = new Date(today); d.cleared['daily-' + dateKey(t)] || (streak === 0 && dateKey(t) === key); t.setDate(t.getDate() - 1)) if (d.cleared['daily-' + dateKey(t)]) streak++;
    if (streak) this.root.append(el('div', 'streak', `${streak} day${streak > 1 ? 's' : ''} in a row`));
    this.root.append(this.press(el('button', 'tab back', '← back'), () => this.show('title')));
  }

  /** The Sumo ladder: twelve opponents, each opening when the one before is beaten. */
  private sumo() {
    this.toy.load(null);
    const d = loadSave();
    const per = 4;
    const pages = Math.ceil(OPPONENTS.length / per);
    this.root.append(el('div', 'chapter-title', `Sumo<br><span>The Ladder</span>`));
    const grid = el('div', 'levels');
    for (let k = this.sumoPage * per; k < Math.min(OPPONENTS.length, (this.sumoPage + 1) * per); k++) {
      const lv = sumoLevel(k);
      const open = k === 0 || d.cleared['sumo-' + k] || import.meta.env.DEV;
      const b = el('button', `note lvl ${open ? '' : 'locked'} ${d.cleared[lv.id] ? 'done' : ''}`, `<em>${k + 1}</em><b>${lv.title}</b><span class="slots"><small>${open ? OPPONENTS[k].counter : ''}</small></span>`);
      b.insertBefore(levelThumb(lv), b.querySelector('.slots'));
      b.style.setProperty('--tilt', `${((k * 37) % 7) - 3}deg`);
      b.style.animationDelay = `${(k % per) * 40}ms`;
      if (open) this.press(b, () => this.show('play', lv));
      grid.append(b);
    }
    this.root.append(grid);
    const nav = el('div', 'pager chapters');
    const go = (n: number) => () => {
      this.sumoPage = (this.sumoPage + n + pages) % pages;
      this.show('sumo');
    };
    nav.append(this.press(el('button', 'tab', '‹'), go(-1)), el('span', '', `page ${this.sumoPage + 1} of ${pages}`), this.press(el('button', 'tab', '›'), go(1)));
    this.root.append(nav);
    this.root.append(
      this.press(el('button', 'note versus', '<b>Pass &amp; play</b><small>two players, best of five</small>'), () => {
        this.vs = { on: true, round: 0, score: [0, 0], timer: 0 };
        this.versusRound();
      }),
    );
    this.root.append(this.press(el('button', 'tab back', '← back'), () => this.show('title')));
  }

  private hud(level: LevelDef | null, back: Screen = 'title') {
    const bar = el('div', 'hud');
    if (level) {
      bar.append(this.press(el('button', 'icon retry', '<svg viewBox="0 0 40 40"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M29.5 13.5c-3-4.6-9.6-6-14.4-3.1-5 3-6.6 9.7-3.5 14.6 3 4.8 9.6 6.3 14.5 3.3 2.4-1.5 4-3.7 4.6-6.3" stroke-width="3.4"/><path d="M30.2 14.2c-3.2-4.2-9.3-5.4-13.9-2.8" stroke-width="1.4" opacity=".55"/><path d="M31.4 6.6l-.6 8.2-8.1-.9" stroke-width="3.4"/></g></svg>'), () => this.retry()));
    }
    bar.append(this.press(el('button', 'icon back', '<svg viewBox="0 0 40 40"><g fill="none" stroke="currentColor" stroke-linecap="round"><path d="M14.5 10.5c.3 6.4-.2 12.7.4 19" stroke-width="4"/><path d="M25.8 10.2c-.4 6.5.3 12.9-.2 19.3" stroke-width="4"/><path d="M15.4 11.5c.1 5.6 0 11.3.5 16.8" stroke-width="1.3" opacity=".5"/></g></svg>'), () => this.pause(level, back)));
    this.root.append(bar);
  }

  /** Pause (look-and-feel §8): a sticky note over a soft scrim, opens in 150 ms. */
  private pause(level: LevelDef | null, back: Screen) {
    if (this.root.querySelector('.scrim')) return;
    this.toy.paused = true;
    const scrim = el('div', 'scrim');
    const note = el('div', 'note pause-note');
    const close = () => {
      this.toy.paused = false;
      scrim.remove();
    };
    note.append(el('b', '', 'Paused'));
    note.append(this.press(el('button', 'line', 'Keep drawing'), close));
    if (level)
      note.append(
        this.press(el('button', 'line', 'Start over'), () => {
          close();
          this.retry();
        }),
      );
    note.append(
      this.press(el('button', 'line', level ? 'Levels' : back === 'title' ? 'Title' : 'Sketchbook'), () => {
        this.toy.paused = false;
        this.show(level ? this.home(level) : back);
      }),
    );
    scrim.append(note);
    scrim.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (e.target === scrim) close();
    });
    this.root.append(scrim);
  }

  /** Fail: tap anywhere retries; a small Watch button sits beside the prompt. */
  private failWatch() {
    if (this.vs.on && this.screen === 'play') return this.versusResult(false);
    if (this.screen !== 'play' || this.card) return;
    this.root.querySelector('.watch-fail')?.remove();
    const b = this.press(el('button', 'tab watch-fail', '▶ watch'), () => {
      b.remove();
      this.toy.watch();
    });
    this.root.append(b);
  }

  private retry() {
    if (this.vs.on) return; // a pass-and-play round is played once
    if (this.toy.level?.id === 'doodle') return this.show('doodle'); // a fresh page, switches off
    this.root.querySelector('.watch-fail')?.remove();
    if (this.card) {
      this.card.remove();
      this.card = null;
    }
    this.toy.retry();
  }

  private endCard(info: { level: LevelDef; heroes: { name: string; kind: string }[]; newBadges: string[]; epitaph: string }) {
    if (this.screen !== 'play' || this.toy.level?.id !== info.level.id) return;
    if (this.vs.on) return this.versusResult(true);
    const d = loadSave();
    const badges = d.badges[info.level.id] ?? [];
    const c = el('div', 'endcard');
    const names = info.heroes.slice(0, 3).map((h) => `<div class="plate">${h.name}</div>`).join('');
    const slots = [0, 1, 2].map((k) => `<i class="slot ${badges[k] ? 'on' : ''} ${badges[k] && info.newBadges.includes(badges[k]) ? 'new' : ''}"></i>`).join('');
    c.innerHTML = `${names}<p class="epitaph">${info.epitaph}</p><div class="badges">${slots}<small>${badges.length ? 'Cleared with: ' + badges.map((b) => 'the ' + b).join(' · ') : ''}</small></div>`;
    const idx = ALL_LEVELS.findIndex((l) => l.id === info.level.id);
    const rung = info.level.goal.type === 'sumo' ? Number(info.level.id.slice(5)) : 0;
    const next = rung ? (rung < OPPONENTS.length ? sumoLevel(rung) : undefined) : idx >= 0 ? ALL_LEVELS[idx + 1] : undefined;
    const row = el('div', 'buttons');
    if (info.level.goal.type === 'boss') row.append(this.press(el('button', 'note small go', 'The End →'), () => this.show('credits')));
    else if (next) row.append(this.press(el('button', 'note small go', 'Next →'), () => this.show('play', next)));
    else if (info.level.mod) row.append(this.press(el('button', 'note small go', 'Stamped!'), () => this.show('daily')));
    else if (rung) row.append(this.press(el('button', 'note small go', 'Ladder done!'), () => this.show('sumo')));
    else row.append(this.press(el('button', 'note small go', 'Chapter done!'), () => this.show('chapter')));
    row.append(this.press(el('button', 'note small', 'Retry'), () => this.retry()));
    row.append(
      this.press(el('button', 'note small watch', '▶ Watch'), () => {
        c.style.display = 'none';
        this.toy.watch();
      }),
    );
    if (Toy.canRecord())
      row.append(
        this.press(el('button', 'note small watch', 'Save clip'), () => {
          c.style.display = 'none';
          this.toy.watch(true);
        }),
      );
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
    // volumes: pencil-line sliders (design §15: sound, music and voices)
    const slider = (label: string, get: () => number, set: (v: number) => void) => {
      const row = el('label', 'slider', `<span>${label}</span>`);
      const r = document.createElement('input');
      r.type = 'range';
      r.min = '0';
      r.max = '1';
      r.step = '0.05';
      r.value = String(get());
      r.addEventListener('input', () => set(Number(r.value)));
      r.addEventListener('change', () => save());
      r.addEventListener('pointerdown', (e) => e.stopPropagation());
      row.append(r);
      box.append(row);
    };
    slider('Sound', () => s.sound, (v) => (s.sound = v));
    slider('Music', () => s.music, (v) => (s.music = v));
    slider('Voices', () => s.voices, (v) => (s.voices = v));
    toggle('Gentle mode (slower, more ink)', () => s.gentle, (v) => (s.gentle = v));
    toggle('Intent lines', () => s.intentLines, (v) => (s.intentLines = v));
    toggle('Reduced motion', () => s.reducedMotion, (v) => (s.reducedMotion = v));
    toggle('Haptics', () => s.haptics, (v) => (s.haptics = v));
    toggle('Left-handed (buttons on the left)', () => s.leftHanded, (v) => (s.leftHanded = v));
    this.root.append(box);
    this.root.append(this.press(el('button', 'tab back', '← back'), () => this.show('title')));
  }
}
