/**
 * ALL visible copy lives in this file. Everything here is placeholder content:
 * the player, the teams, the scores and the stats are fictional. Replace freely.
 *
 * Each dictionary has the same keys for both languages, and the ENG / ESP picker swaps them live.
 */
export type Locale = 'en' | 'es';

export const BRAND = {
  /** The final letter of `third` is drawn by the spinning sun emblem, so it is left out here. */
  the: 'The',
  last: 'Last',
  third: 'Temp',
  thirdFull: 'Tempo',
  player: 'Lorem Ipsum Dolor',
  playerShort: 'Lorem',
};

const en = {
  pride: 'Pride of the Game',
  enter: 'Enter',
  intro:
    'Millions of tiny points gather into one figure, a placeholder tribute to the game we love. One for every goal. Every record. Every moment of <b>Lorem</b>’s final tournament.',
  eachGoal: `Every goal. Every record. Every moment<br/>of <strong>Lorem</strong>’s final tournament.`,
  seeMore: 'See more',
  goals: 'Goals',
  records: 'Records',
  close: 'Close',
  minute: 'Minute',
  distance: 'Distance',
  possession: 'Possession',
  legal: 'Legal notice',
  about: 'About the tribute',
  firstHalf: 'FH',
  secondHalf: 'SH',
  stoppage: 'ST',
  notFoundTitle: '404',
  notFoundBody: 'The page you are looking for does not exist.',
  notFoundCta: 'Back to the pitch',
  camera: { tv: 'TV', goal_cam: 'Goal Cam', follow: 'Follow', close: 'Close' },
  metaTitle: 'The Last Tempo / Placeholder tribute',
  metaAboutTitle: 'The Last Tempo / About',
  metaLegalTitle: 'The Last Tempo / Legal notice',
};

const es: typeof en = {
  pride: 'Orgullo del juego',
  enter: 'Entrar',
  intro:
    'Millones de pequeños puntos se reúnen en una figura, un homenaje de ejemplo al juego que amamos. Uno por cada gol. Cada récord. Cada momento del último torneo de <b>Lorem</b>.',
  eachGoal: `Cada gol. Cada récord. Cada momento<br/>del último torneo de <strong>Lorem</strong>.`,
  seeMore: 'Ver más',
  goals: 'Goles',
  records: 'Récords',
  close: 'Cerrar',
  minute: 'Minuto',
  distance: 'Distancia',
  possession: 'Posesión',
  legal: 'Aviso legal',
  about: 'Sobre el homenaje',
  firstHalf: 'PT',
  secondHalf: 'ST',
  stoppage: 'AD',
  notFoundTitle: '404',
  notFoundBody: 'La página que buscas no existe.',
  notFoundCta: 'Volver a la cancha',
  camera: { tv: 'TV', goal_cam: 'Cámara de arco', follow: 'Seguimiento', close: 'Cercana' },
  metaTitle: 'The Last Tempo / Homenaje de ejemplo',
  metaAboutTitle: 'The Last Tempo / Sobre el homenaje',
  metaLegalTitle: 'The Last Tempo / Aviso legal',
};

export const DICT: Record<Locale, typeof en> = { en, es };

/** Rich text for the About page. Allowed tags: b, strong, a, br. Blank lines come from <br/><br/>. */
export const ABOUT: Record<Locale, { title: string; body: string }> = {
  en: {
    title: 'For the one who made the game feel new',
    body: `For years, <strong>Lorem Ipsum</strong> carried the hopes of a whole crowd on his shoulders. This paragraph is placeholder copy, written to hold the same rhythm and length as the real story that will go here one day.<br/><br/>
Then one night, everything changed.<br/><br/>
Alongside a <strong>squad</strong> that became a family, and a staff who believed in one simple idea, he gave people something they could keep. Dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor.<br/><br/>
He made strangers embrace.<br/>
He silenced whole stadiums.<br/>
He filled the streets at midnight.<br/>
He made grandparents sing.<br/>
He made us believe.<br/><br/>
He gave us a joy that does not fade.<br/><br/>
Every one of those nights left a mark on someone. That thought is what started this project, and it is what every line of it is built around.<br/><br/>
Each point you see in this experience stands for more than a pixel on a screen.<br/><br/>
It stands for a person.<br/>
Somebody watching from a crowded kitchen.<br/>
Somebody holding their breath in the top row.<br/>
Somebody hugging a neighbour for the first time.<br/>
Somebody who felt, even for a second, that the whole world was in step.<br/><br/>
That is why this placeholder tribute is built from millions of points. In the end, nobody plays alone.<br/><br/>
He was always carried along by everyone who grew up watching him, who suffered with him, and who ended up celebrating with him.<br/><br/>
The studio name goes here: <a href="#" class="text-gold">/your.studio</a> built this tribute together with friends and fans in just <strong>ten (10)</strong> days. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip.<br/><br/>
We made this interactive experience to relive the final goals of a career, to walk around the records it left behind, and to look again, from a new angle, at moments that already belong to everybody.<br/><br/>
We turned those plays into a journey of millions of points, full of depth, movement and feeling.<br/><br/>
We wanted to feel, in another way, what happens when the ball crosses the line.<br/><br/>
The second of silence before the roar.<br/>
The embrace.<br/>
The look up to the sky.<br/>
The feeling that, for one moment, millions of people were feeling exactly the same thing.<br/><br/>
This tribute is for <strong>Lorem Ipsum</strong>.<br/><br/>
But it is also for every teammate who stood beside him, for the staff who made the story possible, and for all the fans who supported, suffered, believed and celebrated.<br/><br/>
It is our small way of saying thank you for the hope, and for a joy that stays with us.<br/><br/>
Thank you, Lorem.<br/>
Thank you, team.<br/>
Thank you for making it feel new.`,
  },
  es: {
    title: 'Para quien hizo que el juego se sintiera nuevo',
    body: `Durante años, <strong>Lorem Ipsum</strong> cargó con la ilusión de toda una multitud. Este párrafo es un texto de ejemplo, escrito para mantener el mismo ritmo y largo que la historia real que irá aquí algún día.<br/><br/>
Hasta que una noche, todo cambió.<br/><br/>
Junto a un <strong>plantel</strong> que se volvió familia, y un cuerpo técnico que creyó en una idea simple, nos regaló algo para siempre. Dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor.<br/><br/>
Hizo abrazarse a desconocidos.<br/>
Silenció estadios enteros.<br/>
Llenó las calles a medianoche.<br/>
Hizo cantar a los abuelos.<br/>
Nos hizo creer.<br/><br/>
Nos dio una alegría que no se apaga.<br/><br/>
Cada una de esas noches dejó una marca en alguien. Esa idea es la que dio origen a este proyecto.<br/><br/>
Cada punto que ves en esta experiencia es mucho más que un píxel en una pantalla.<br/><br/>
Es una persona.<br/>
Alguien que miraba desde una cocina llena de gente.<br/>
Alguien que contuvo la respiración en la última fila.<br/>
Alguien que abrazó a su vecino por primera vez.<br/>
Alguien que sintió, aunque sea por un segundo, que el mundo entero iba al mismo paso.<br/><br/>
Por eso este homenaje de ejemplo está hecho de millones de puntos. Al final, nadie juega solo.<br/><br/>
Siempre lo acompañaron quienes crecieron viéndolo, quienes sufrieron con él y quienes terminaron celebrando con él.<br/><br/>
Aquí va el nombre del estudio: <a href="#" class="text-gold">/your.studio</a> creó este homenaje con amigos e hinchas en apenas <strong>diez (10)</strong> días. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip.<br/><br/>
Hicimos esta experiencia interactiva para revivir los últimos goles de una carrera, recorrer los récords que dejó y volver a mirar, desde otro ángulo, momentos que ya son de todos.<br/><br/>
Convertimos esas jugadas en un viaje de millones de puntos, lleno de profundidad, movimiento y emoción.<br/><br/>
Quisimos sentir, de otra manera, lo que pasa cuando la pelota cruza la línea.<br/><br/>
El segundo de silencio antes del grito.<br/>
El abrazo.<br/>
La mirada al cielo.<br/>
La sensación de que, por un momento, millones de personas sentían exactamente lo mismo.<br/><br/>
Este homenaje es para <strong>Lorem Ipsum</strong>.<br/><br/>
Pero también es para cada compañero que estuvo a su lado, para el cuerpo técnico que hizo posible la historia y para todos los hinchas que alentaron, sufrieron, creyeron y celebraron.<br/><br/>
Es nuestra pequeña forma de decir gracias por la esperanza y por una alegría que se queda con nosotros.<br/><br/>
Gracias, Lorem.<br/>
Gracias, equipo.<br/>
Gracias por hacerlo sentir nuevo.`,
  },
};

export const LEGAL: Record<Locale, { title: string; body: string }> = {
  en: {
    title: 'Legal notice',
    body: `This is placeholder legal copy. Replace it with your own notice before publishing.<br/><br/>
<strong>Purpose.</strong> Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.<br/><br/>
<strong>Fictional content.</strong> The player, teams, scores, records and stadiums shown on this site are invented for demonstration. Any resemblance to real people or events is coincidental.<br/><br/>
<strong>Media.</strong> Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.<br/><br/>
<strong>Analytics and cookies.</strong> Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis.<br/><br/>
<strong>Contact.</strong> Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit. Write to <a href="#" class="text-gold">hello@your.studio</a>.`,
  },
  es: {
    title: 'Aviso legal',
    body: `Este es un texto legal de ejemplo. Reemplázalo con tu propio aviso antes de publicar.<br/><br/>
<strong>Finalidad.</strong> Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.<br/><br/>
<strong>Contenido ficticio.</strong> El jugador, los equipos, resultados, récords y estadios que aparecen en este sitio son inventados con fines de demostración. Cualquier parecido con personas o hechos reales es casual.<br/><br/>
<strong>Medios.</strong> Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.<br/><br/>
<strong>Analítica y cookies.</strong> Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis.<br/><br/>
<strong>Contacto.</strong> Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit. Escribe a <a href="#" class="text-gold">hello@your.studio</a>.`,
  },
};

export type Goal = {
  id: number;
  order: number;
  home: string;
  away: string;
  awayFlag: string;
  /** Score of the match once this goal went in. */
  scoreHome: number;
  scoreAway: number;
  minute: number;
  half: 'firstHalf' | 'secondHalf' | 'stoppage';
  distance: number;
  possessionHome: number;
  stadium: string;
  date: Record<Locale, string>;
};

const HOME = 'AUR';

const goal = (
  order: number,
  away: string,
  scoreHome: number,
  scoreAway: number,
  minute: number,
  half: Goal['half'],
  distance: number,
  possessionHome: number,
  stadium: string,
  en: string,
  es: string,
): Goal => ({
  id: order + 1,
  order,
  home: HOME,
  away,
  awayFlag: `/images/flags/${away.toLowerCase()}.svg`,
  scoreHome,
  scoreAway,
  minute,
  half,
  distance,
  possessionHome,
  stadium,
  date: { en, es },
});

export const GOALS: Goal[] = [
  goal(0, 'BOR', 1, 0, 19, 'firstHalf', 21, 47, 'Lorem City Stadium', 'June 14, 2030', '14 de junio, 2030'),
  goal(1, 'BOR', 2, 0, 58, 'secondHalf', 16, 51, 'Lorem City Stadium', 'June 14, 2030', '14 de junio, 2030'),
  goal(2, 'BOR', 3, 0, 74, 'secondHalf', 27, 55, 'Lorem City Stadium', 'June 14, 2030', '14 de junio, 2030'),
  goal(3, 'CAS', 1, 0, 36, 'firstHalf', 11, 58, 'Ipsum Park', 'June 21, 2030', '21 de junio, 2030'),
  goal(4, 'CAS', 2, 0, 92, 'stoppage', 8, 62, 'Ipsum Park', 'June 21, 2030', '21 de junio, 2030'),
  goal(5, 'DEL', 3, 1, 81, 'secondHalf', 24, 49, 'Dolor Arena', 'June 28, 2030', '28 de junio, 2030'),
  goal(6, 'ESM', 3, 2, 33, 'firstHalf', 19, 44, 'Amet Field', 'July 3, 2030', '3 de julio, 2030'),
  goal(7, 'FAR', 3, 2, 85, 'secondHalf', 30, 53, 'Sit Grande', 'July 8, 2030', '8 de julio, 2030'),
];

export type RecordIcon = 'trophy' | 'armband' | 'medal' | 'pitch' | 'clock' | 'wins' | 'assist' | 'cake' | 'ball' | 'calendar' | 'boot';

export type RecordItem = {
  id: number;
  order: number;
  number: number;
  title: Record<Locale, string>;
  label: Record<Locale, string>;
  icon: RecordIcon;
};

const rec = (order: number, number: number, enT: string, enL: string, esT: string, esL: string, icon: RecordIcon): RecordItem => ({
  id: order + 1,
  order,
  number,
  title: { en: enT, es: esT },
  label: { en: enL, es: esL },
  icon,
});

export const RECORDS: RecordItem[] = [
  rec(0, 41, 'Goals and assists combined', 'Most in tournament history', 'Goles y asistencias', 'La mayor cifra del torneo', 'boot'),
  rec(1, 4, 'Finals played as captain', 'More than any other player', 'Finales como capitán', 'Más que nadie', 'armband'),
  rec(2, 19, 'Player of the match awards', 'Placeholder record text here', 'Premios al mejor del partido', 'Texto de récord de ejemplo', 'medal'),
  rec(3, 37, 'Tournament matches', 'More than any other player', 'Partidos de torneo', 'Más que nadie', 'pitch'),
  rec(4, 2940, 'Minutes played', 'Most in tournament history', 'Minutos jugados', 'La mayor cifra del torneo', 'clock'),
  rec(5, 26, 'Tournament wins', 'More than any other player', 'Victorias en torneos', 'Más que nadie', 'wins'),
  rec(6, 15, 'Assists', 'Top provider in tournament history', 'Asistencias', 'El máximo asistidor del torneo', 'assist'),
  rec(7, 39, 'Years old', 'Oldest scorer of a hat trick', 'Años', 'El goleador más veterano', 'cake'),
  rec(8, 2, 'Golden boots', 'First and only player', 'Botines de oro', 'El primero y único', 'ball'),
  rec(9, 18, 'Years inspiring generations', 'Placeholder dates go here', 'Años inspirando generaciones', 'Aquí van las fechas', 'calendar'),
];
