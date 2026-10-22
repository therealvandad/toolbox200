// Vocabulary builder: 200+ advanced words, word of the day, SM-2 flashcards and a quiz.
import { el, render, store, shuffle, today, stat, toast } from '../../lib/ui.js';

// [word, part of speech, definition, example]
const WORDS = [
  ['abate', 'v.', 'to become less intense or widespread', 'The storm finally abated by morning.'],
  ['aberration', 'n.', 'a departure from what is normal or expected', 'The cold July day was an aberration.'],
  ['abstruse', 'adj.', 'difficult to understand; obscure', 'His lecture on quantum gravity was abstruse.'],
  ['acquiesce', 'v.', 'to accept something reluctantly but without protest', 'She acquiesced to the new schedule.'],
  ['acrimonious', 'adj.', 'angry and bitter in tone', 'The divorce turned acrimonious.'],
  ['acumen', 'n.', 'the ability to make good judgments quickly', 'Her business acumen built the company.'],
  ['adamant', 'adj.', 'refusing to be persuaded or change one\'s mind', 'He was adamant that he had been right.'],
  ['admonish', 'v.', 'to warn or reprimand firmly', 'The coach admonished the team for arriving late.'],
  ['adroit', 'adj.', 'clever or skillful in using the hands or mind', 'An adroit negotiator, she closed the deal in an hour.'],
  ['aesthetic', 'adj.', 'concerned with beauty or the appreciation of beauty', 'The building has real aesthetic appeal.'],
  ['affable', 'adj.', 'friendly, good-natured and easy to talk to', 'The affable host greeted every guest by name.'],
  ['aggrandize', 'v.', 'to increase the power, status or wealth of', 'He used the position to aggrandize himself.'],
  ['alacrity', 'n.', 'brisk and cheerful readiness', 'She accepted the invitation with alacrity.'],
  ['altruistic', 'adj.', 'showing selfless concern for the well-being of others', 'His altruistic donation funded the clinic.'],
  ['ambivalent', 'adj.', 'having mixed feelings about something', 'I feel ambivalent about moving abroad.'],
  ['ameliorate', 'v.', 'to make something bad better', 'The new drug ameliorates the symptoms.'],
  ['amiable', 'adj.', 'having a friendly and pleasant manner', 'An amiable chat put everyone at ease.'],
  ['anachronism', 'n.', 'something out of its proper time period', 'A wristwatch in a Roman epic is an anachronism.'],
  ['anomaly', 'n.', 'something that deviates from the norm', 'The sensor logged an anomaly at midnight.'],
  ['antipathy', 'n.', 'a deep-seated feeling of dislike', 'She felt antipathy toward her rival.'],
  ['apathetic', 'adj.', 'showing no interest or enthusiasm', 'Voters seemed apathetic about the election.'],
  ['arbitrary', 'adj.', 'based on random choice rather than reason', 'The deadline felt entirely arbitrary.'],
  ['arcane', 'adj.', 'understood by few; mysterious', 'The ritual followed arcane rules.'],
  ['arduous', 'adj.', 'involving great effort; difficult and tiring', 'The climb to the summit was arduous.'],
  ['articulate', 'adj.', 'able to express ideas fluently and clearly', 'She gave an articulate defense of the plan.'],
  ['ascetic', 'adj.', 'practicing severe self-discipline and abstention', 'The monk led an ascetic life.'],
  ['assiduous', 'adj.', 'showing great care and persistence', 'Assiduous practice made him a fine pianist.'],
  ['astute', 'adj.', 'having a sharp ability to assess situations', 'An astute observer noticed the error at once.'],
  ['audacious', 'adj.', 'showing a willingness to take bold risks', 'The audacious plan paid off.'],
  ['austere', 'adj.', 'severe or strict; plain and without comfort', 'The room was austere, with one chair and a bed.'],
  ['avarice', 'n.', 'extreme greed for wealth', 'Avarice drove him to cheat his partners.'],
  ['banal', 'adj.', 'so lacking in originality as to be obvious and boring', 'The speech was full of banal clichés.'],
  ['belie', 'v.', 'to fail to give a true impression of; contradict', 'His calm voice belied his anxiety.'],
  ['belligerent', 'adj.', 'hostile and aggressive', 'The belligerent fan was escorted out.'],
  ['benevolent', 'adj.', 'well-meaning and kindly', 'A benevolent donor paid the hospital bills.'],
  ['bolster', 'v.', 'to support or strengthen', 'Good reviews bolstered ticket sales.'],
  ['bombastic', 'adj.', 'high-sounding but with little meaning; inflated', 'The bombastic speech impressed no one.'],
  ['brevity', 'n.', 'concise and exact use of words', 'Brevity is the soul of wit.'],
  ['bucolic', 'adj.', 'relating to the pleasant aspects of the countryside', 'They retired to a bucolic village.'],
  ['burgeon', 'v.', 'to grow or increase rapidly; flourish', 'The town burgeoned after the railway arrived.'],
  ['cacophony', 'n.', 'a harsh, discordant mixture of sounds', 'A cacophony of horns filled the street.'],
  ['cajole', 'v.', 'to persuade by flattery or coaxing', 'She cajoled him into joining the trip.'],
  ['callous', 'adj.', 'showing a cruel disregard for others', 'The callous remark hurt her deeply.'],
  ['candor', 'n.', 'the quality of being open and honest', 'He spoke with surprising candor about his failures.'],
  ['capitulate', 'v.', 'to cease resisting; surrender', 'The city capitulated after a long siege.'],
  ['capricious', 'adj.', 'given to sudden changes of mood or behavior', 'The capricious weather ruined our picnic plans.'],
  ['castigate', 'v.', 'to reprimand severely', 'The editorial castigated the council for the delay.'],
  ['catalyst', 'n.', 'a person or thing that precipitates an event', 'The scandal was a catalyst for reform.'],
  ['caustic', 'adj.', 'sarcastic in a scathing and bitter way', 'His caustic wit made enemies.'],
  ['chicanery', 'n.', 'the use of trickery to achieve a goal', 'The contract was won through chicanery.'],
  ['circumspect', 'adj.', 'wary and unwilling to take risks', 'Be circumspect when sharing personal data.'],
  ['clandestine', 'adj.', 'kept secret or done secretively', 'They held clandestine meetings at night.'],
  ['coalesce', 'v.', 'to come together to form one mass or whole', 'The groups coalesced into a single party.'],
  ['cogent', 'adj.', 'clear, logical and convincing', 'She made a cogent argument for the change.'],
  ['complacent', 'adj.', 'smugly satisfied and unaware of danger', 'Success made the team complacent.'],
  ['conciliatory', 'adj.', 'intended to placate or pacify', 'He adopted a conciliatory tone after the dispute.'],
  ['concise', 'adj.', 'giving much information clearly in few words', 'Keep the summary concise.'],
  ['condone', 'v.', 'to accept or allow behavior considered wrong', 'The school does not condone bullying.'],
  ['conflagration', 'n.', 'an extensive, destructive fire', 'The conflagration destroyed the warehouse.'],
  ['conundrum', 'n.', 'a confusing and difficult problem', 'The budget posed a real conundrum.'],
  ['copious', 'adj.', 'abundant in supply', 'She took copious notes during the lecture.'],
  ['corroborate', 'v.', 'to confirm or give support to a statement', 'Two witnesses corroborated his account.'],
  ['credulous', 'adj.', 'too ready to believe things', 'Credulous investors lost their savings.'],
  ['cryptic', 'adj.', 'having a meaning that is mysterious or obscure', 'He left a cryptic note on the desk.'],
  ['culpable', 'adj.', 'deserving blame', 'The firm was found culpable for the leak.'],
  ['cursory', 'adj.', 'hasty and therefore not thorough', 'A cursory glance missed the typo.'],
  ['debacle', 'n.', 'a sudden and ignominious failure; a fiasco', 'The product launch was a debacle.'],
  ['decorum', 'n.', 'behavior in keeping with good taste and propriety', 'The ceremony was conducted with decorum.'],
  ['deference', 'n.', 'humble submission and respect', 'He bowed in deference to the elders.'],
  ['deleterious', 'adj.', 'causing harm or damage', 'Smoking has deleterious effects on health.'],
  ['demagogue', 'n.', 'a leader who appeals to popular desires and prejudices', 'The demagogue stirred up the crowd.'],
  ['denigrate', 'v.', 'to criticize unfairly; disparage', 'Do not denigrate her efforts.'],
  ['deride', 'v.', 'to express contempt for; ridicule', 'Critics derided the film as shallow.'],
  ['despondent', 'adj.', 'in low spirits from loss of hope', 'He grew despondent after the rejection.'],
  ['diatribe', 'n.', 'a forceful and bitter verbal attack', 'She launched into a diatribe against the policy.'],
  ['didactic', 'adj.', 'intended to teach, often in a patronizing way', 'The novel is heavily didactic.'],
  ['diffident', 'adj.', 'modest or shy because of a lack of confidence', 'The diffident student rarely spoke.'],
  ['dilatory', 'adj.', 'slow to act; intended to cause delay', 'Dilatory tactics stalled the vote.'],
  ['diligent', 'adj.', 'showing care and conscientiousness in work', 'A diligent audit caught the error.'],
  ['discern', 'v.', 'to perceive or recognize something', 'I could discern a faint light ahead.'],
  ['disparate', 'adj.', 'essentially different in kind', 'The report merged disparate data sources.'],
  ['disseminate', 'v.', 'to spread widely', 'The results were disseminated online.'],
  ['dogmatic', 'adj.', 'inclined to lay down principles as undeniably true', 'His dogmatic views left no room for debate.'],
  ['ebullient', 'adj.', 'cheerful and full of energy', 'The ebullient crowd cheered for an hour.'],
  ['eclectic', 'adj.', 'deriving ideas from a broad range of sources', 'Her eclectic taste spans jazz and punk.'],
  ['efficacious', 'adj.', 'successful in producing a desired result', 'The treatment proved efficacious.'],
  ['egregious', 'adj.', 'outstandingly bad; shocking', 'An egregious error cost them the match.'],
  ['eloquent', 'adj.', 'fluent and persuasive in speaking or writing', 'She gave an eloquent tribute.'],
  ['elucidate', 'v.', 'to make something clear; explain', 'The diagram elucidates the process.'],
  ['emulate', 'v.', 'to match or surpass by imitation', 'Young players try to emulate their heroes.'],
  ['enervate', 'v.', 'to weaken or drain of energy', 'The heat enervated the hikers.'],
  ['enigmatic', 'adj.', 'difficult to interpret or understand; mysterious', 'She gave an enigmatic smile.'],
  ['ephemeral', 'adj.', 'lasting for a very short time', 'Fame on social media is often ephemeral.'],
  ['equanimity', 'n.', 'calmness and composure, especially under stress', 'He faced the verdict with equanimity.'],
  ['equivocal', 'adj.', 'ambiguous; open to more than one interpretation', 'The minister gave an equivocal answer.'],
  ['erudite', 'adj.', 'having or showing great knowledge', 'An erudite scholar annotated the text.'],
  ['esoteric', 'adj.', 'intended for or understood by only a small group', 'The journal covers esoteric topics in logic.'],
  ['euphemism', 'n.', 'a mild word substituted for a harsh one', '"Passed away" is a euphemism for died.'],
  ['exacerbate', 'v.', 'to make a problem worse', 'Rain exacerbated the flooding.'],
  ['exculpate', 'v.', 'to show or declare that someone is not guilty', 'New evidence exculpated the defendant.'],
  ['exemplary', 'adj.', 'serving as a desirable model; very good', 'Her conduct was exemplary.'],
  ['exhaustive', 'adj.', 'including all elements; thorough', 'The report is exhaustive on the subject.'],
  ['exorbitant', 'adj.', 'unreasonably high (of a price)', 'The hotel charged exorbitant rates.'],
  ['expedient', 'adj.', 'convenient and practical, though possibly improper', 'It was expedient to settle out of court.'],
  ['extol', 'v.', 'to praise enthusiastically', 'The ad extols the virtues of the new phone.'],
  ['facetious', 'adj.', 'treating serious issues with inappropriate humor', 'His facetious remark fell flat at the funeral.'],
  ['fallacious', 'adj.', 'based on a mistaken belief', 'The argument rests on a fallacious premise.'],
  ['fastidious', 'adj.', 'very attentive to accuracy and detail', 'A fastidious editor caught every misprint.'],
  ['fatuous', 'adj.', 'silly and pointless', 'He made a fatuous comment about the weather.'],
  ['fervent', 'adj.', 'having intense passion', 'She is a fervent supporter of the arts.'],
  ['flagrant', 'adj.', 'conspicuously offensive', 'It was a flagrant violation of the rules.'],
  ['fortuitous', 'adj.', 'happening by chance, often luckily', 'A fortuitous meeting led to the job.'],
  ['frugal', 'adj.', 'sparing or economical with money or food', 'A frugal lifestyle let them retire early.'],
  ['furtive', 'adj.', 'attempting to avoid notice; secretive', 'He cast a furtive glance at the door.'],
  ['garrulous', 'adj.', 'excessively talkative', 'The garrulous guide never paused for breath.'],
  ['gregarious', 'adj.', 'fond of company; sociable', 'Gregarious by nature, she loves parties.'],
  ['hackneyed', 'adj.', 'overused and therefore lacking significance', 'The plot relies on hackneyed twists.'],
  ['harangue', 'n.', 'a lengthy and aggressive speech', 'The manager delivered a harangue about punctuality.'],
  ['hegemony', 'n.', 'leadership or dominance over others', 'The empire\'s hegemony lasted centuries.'],
  ['heresy', 'n.', 'belief contrary to orthodox doctrine', 'His theory was considered scientific heresy.'],
  ['iconoclast', 'n.', 'a person who attacks cherished beliefs', 'An iconoclast, she rejected every tradition.'],
  ['idiosyncrasy', 'n.', 'a distinctive or peculiar habit', 'Humming while typing is one of his idiosyncrasies.'],
  ['ignominious', 'adj.', 'deserving or causing public disgrace', 'The team suffered an ignominious defeat.'],
  ['immutable', 'adj.', 'unchanging over time', 'The laws of physics are immutable.'],
  ['impasse', 'n.', 'a situation in which no progress is possible', 'Talks reached an impasse.'],
  ['impeccable', 'adj.', 'in accordance with the highest standards; faultless', 'His manners were impeccable.'],
  ['impetuous', 'adj.', 'acting quickly without thought or care', 'An impetuous decision cost him dearly.'],
  ['implacable', 'adj.', 'unable to be appeased', 'She faced an implacable opponent.'],
  ['inane', 'adj.', 'silly; lacking sense', 'The show is full of inane chatter.'],
  ['incessant', 'adj.', 'continuing without pause', 'The incessant rain flooded the roads.'],
  ['incisive', 'adj.', 'intelligently analytical and clear-thinking', 'Her incisive questions exposed the flaw.'],
  ['incongruous', 'adj.', 'not in harmony with the surroundings', 'A skyscraper looks incongruous in the village.'],
  ['indefatigable', 'adj.', 'persisting tirelessly', 'An indefatigable campaigner, he never rested.'],
  ['indolent', 'adj.', 'wanting to avoid activity; lazy', 'The indolent cat slept all afternoon.'],
  ['ineffable', 'adj.', 'too great to be expressed in words', 'The view had an ineffable beauty.'],
  ['inexorable', 'adj.', 'impossible to stop or prevent', 'The inexorable rise of automation continues.'],
  ['ingenuous', 'adj.', 'innocent and unsuspecting', 'His ingenuous trust was easily exploited.'],
  ['inimical', 'adj.', 'tending to obstruct or harm; hostile', 'Policies inimical to growth were scrapped.'],
  ['innocuous', 'adj.', 'not harmful or offensive', 'The remark seemed innocuous at the time.'],
  ['insidious', 'adj.', 'proceeding in a gradual, subtle way with harmful effects', 'Rust is an insidious enemy of steel.'],
  ['insipid', 'adj.', 'lacking flavor or interest', 'The soup was insipid and lukewarm.'],
  ['intransigent', 'adj.', 'unwilling to change one\'s views', 'Both sides remained intransigent.'],
  ['intrepid', 'adj.', 'fearless; adventurous', 'Intrepid explorers crossed the ice cap.'],
  ['inundate', 'v.', 'to overwhelm with things to deal with; flood', 'Fans inundated the site with requests.'],
  ['irascible', 'adj.', 'easily angered', 'The irascible chef shouted at the waiters.'],
  ['itinerant', 'adj.', 'traveling from place to place', 'An itinerant preacher visited the town.'],
  ['judicious', 'adj.', 'having or showing good judgment', 'A judicious use of color improved the design.'],
  ['juxtapose', 'v.', 'to place close together for contrast', 'The exhibit juxtaposes old and new works.'],
  ['laconic', 'adj.', 'using very few words', 'His laconic reply was simply "No."'],
  ['languid', 'adj.', 'displaying a pleasant lack of energy', 'They spent a languid afternoon by the pool.'],
  ['lethargic', 'adj.', 'sluggish and apathetic', 'The heat made everyone lethargic.'],
  ['loquacious', 'adj.', 'tending to talk a great deal', 'A loquacious neighbor kept her at the gate.'],
  ['lucid', 'adj.', 'expressed clearly; easy to understand', 'The textbook offers a lucid explanation.'],
  ['magnanimous', 'adj.', 'generous or forgiving, especially toward a rival', 'The champion was magnanimous in victory.'],
  ['malleable', 'adj.', 'easily influenced or shaped', 'Young minds are malleable.'],
  ['maverick', 'n.', 'an unorthodox or independent-minded person', 'The maverick senator ignored party lines.'],
  ['mercurial', 'adj.', 'subject to sudden changes of mood', 'His mercurial temper unsettled the staff.'],
  ['meticulous', 'adj.', 'showing great attention to detail', 'She kept meticulous records.'],
  ['mitigate', 'v.', 'to make less severe or painful', 'Sandbags mitigated the flood damage.'],
  ['mollify', 'v.', 'to appease the anger of; soothe', 'A refund mollified the angry customer.'],
  ['munificent', 'adj.', 'very generous', 'A munificent gift funded the library.'],
  ['myopic', 'adj.', 'lacking foresight; short-sighted', 'A myopic policy ignored long-term costs.'],
  ['nebulous', 'adj.', 'vague or ill-defined', 'The plan remains nebulous.'],
  ['nefarious', 'adj.', 'wicked or criminal', 'The group had nefarious purposes.'],
  ['noxious', 'adj.', 'harmful, poisonous or very unpleasant', 'Noxious fumes forced an evacuation.'],
  ['obdurate', 'adj.', 'stubbornly refusing to change one\'s opinion', 'He remained obdurate despite the evidence.'],
  ['obfuscate', 'v.', 'to make obscure or unclear', 'Jargon only obfuscates the issue.'],
  ['obsequious', 'adj.', 'excessively eager to please or obey', 'The obsequious clerk bowed repeatedly.'],
  ['obstinate', 'adj.', 'stubbornly refusing to change', 'The obstinate mule would not move.'],
  ['ominous', 'adj.', 'giving the impression that something bad will happen', 'Ominous clouds gathered over the hills.'],
  ['onerous', 'adj.', 'involving a heavy burden of effort', 'The onerous paperwork took weeks.'],
  ['opulent', 'adj.', 'ostentatiously rich and luxurious', 'The opulent palace dazzled visitors.'],
  ['ostentatious', 'adj.', 'designed to impress or attract notice; showy', 'An ostentatious display of wealth.'],
  ['panacea', 'n.', 'a solution for all difficulties', 'Technology is not a panacea for education.'],
  ['paradigm', 'n.', 'a typical example or model of something', 'The study became a paradigm for later research.'],
  ['parsimonious', 'adj.', 'unwilling to spend money; stingy', 'A parsimonious landlord refused repairs.'],
  ['paucity', 'n.', 'the presence of something in too small amounts', 'There is a paucity of reliable data.'],
  ['pedantic', 'adj.', 'excessively concerned with minor details or rules', 'His pedantic corrections annoyed everyone.'],
  ['pejorative', 'adj.', 'expressing contempt or disapproval', 'The term is now considered pejorative.'],
  ['perfunctory', 'adj.', 'carried out with minimum effort', 'He gave the report a perfunctory glance.'],
  ['pernicious', 'adj.', 'having a harmful effect, especially gradually', 'Pernicious rumors damaged her reputation.'],
  ['perspicacious', 'adj.', 'having keen insight', 'A perspicacious analyst saw the crash coming.'],
  ['petulant', 'adj.', 'childishly sulky or bad-tempered', 'The petulant star stormed off the set.'],
  ['placate', 'v.', 'to make less angry; pacify', 'He placated the crowd with free tickets.'],
  ['platitude', 'n.', 'a remark used too often to be interesting', 'The speech was a string of platitudes.'],
  ['plausible', 'adj.', 'seeming reasonable or probable', 'She offered a plausible excuse.'],
  ['pragmatic', 'adj.', 'dealing with things sensibly and realistically', 'A pragmatic approach solved the dispute.'],
  ['precarious', 'adj.', 'not securely held; dangerously likely to fall', 'The ladder was in a precarious position.'],
  ['precocious', 'adj.', 'developed earlier than usual (of a child)', 'A precocious reader, she finished novels at six.'],
  ['prevaricate', 'v.', 'to speak or act evasively', 'Stop prevaricating and answer the question.'],
  ['pristine', 'adj.', 'in its original condition; unspoiled', 'The beach was pristine at dawn.'],
  ['prodigious', 'adj.', 'remarkably great in extent or size', 'He has a prodigious memory.'],
  ['profligate', 'adj.', 'recklessly extravagant or wasteful', 'Profligate spending emptied the treasury.'],
  ['prolific', 'adj.', 'producing many works or results', 'A prolific author of forty novels.'],
  ['propensity', 'n.', 'an inclination to behave in a particular way', 'He has a propensity for exaggeration.'],
  ['prosaic', 'adj.', 'commonplace; lacking imagination', 'The explanation was disappointingly prosaic.'],
  ['prudent', 'adj.', 'acting with care and thought for the future', 'It is prudent to save for emergencies.'],
  ['pugnacious', 'adj.', 'eager or quick to argue or fight', 'The pugnacious lawyer relished every clash.'],
  ['quixotic', 'adj.', 'exceedingly idealistic; unrealistic', 'His quixotic quest to end traffic failed.'],
  ['rancor', 'n.', 'bitterness or resentfulness', 'They parted without rancor.'],
  ['recalcitrant', 'adj.', 'obstinately uncooperative', 'The recalcitrant witness refused to answer.'],
  ['reciprocate', 'v.', 'to respond to a gesture by making a corresponding one', 'She reciprocated the invitation.'],
  ['reclusive', 'adj.', 'avoiding the company of other people', 'The reclusive author gave no interviews.'],
  ['recondite', 'adj.', 'little known; obscure', 'The paper deals with a recondite branch of algebra.'],
  ['redundant', 'adj.', 'not or no longer needed; superfluous', 'The second backup was redundant.'],
  ['relegate', 'v.', 'to assign to an inferior rank or position', 'The idea was relegated to a footnote.'],
  ['reprehensible', 'adj.', 'deserving condemnation', 'Leaking the data was reprehensible.'],
  ['rescind', 'v.', 'to revoke, cancel or repeal', 'The offer was rescinded the next day.'],
  ['resilient', 'adj.', 'able to recover quickly from difficulties', 'The resilient community rebuilt within a year.'],
  ['reticent', 'adj.', 'not revealing one\'s thoughts readily', 'He was reticent about his past.'],
  ['reverent', 'adj.', 'feeling or showing deep respect', 'The crowd fell into a reverent silence.'],
  ['sagacious', 'adj.', 'having keen mental discernment; wise', 'A sagacious judge weighed every word.'],
  ['salient', 'adj.', 'most noticeable or important', 'The salient point is the cost.'],
  ['sanguine', 'adj.', 'optimistic, especially in a bad situation', 'She remains sanguine about the outcome.'],
  ['scrupulous', 'adj.', 'diligent and extremely attentive to details; honest', 'A scrupulous accountant reported the error.'],
  ['sedulous', 'adj.', 'showing dedication and diligence', 'Sedulous research uncovered the letters.'],
  ['serendipity', 'n.', 'the occurrence of happy events by chance', 'Finding the café was pure serendipity.'],
  ['sinecure', 'n.', 'a job requiring little work but giving status or pay', 'The post was a well-paid sinecure.'],
  ['soporific', 'adj.', 'tending to induce sleep', 'The soporific lecture emptied the hall.'],
  ['spurious', 'adj.', 'not being what it purports to be; false', 'The claim is based on spurious statistics.'],
  ['stoic', 'adj.', 'enduring pain or hardship without complaint', 'He remained stoic throughout the trial.'],
  ['sublime', 'adj.', 'of such excellence as to inspire awe', 'The sunset was sublime.'],
  ['succinct', 'adj.', 'briefly and clearly expressed', 'Give a succinct summary of the findings.'],
  ['superfluous', 'adj.', 'unnecessary, especially through being more than enough', 'Cut the superfluous adjectives.'],
  ['surreptitious', 'adj.', 'kept secret because it would not be approved of', 'He took a surreptitious photo.'],
  ['sycophant', 'n.', 'a person who flatters the powerful for advantage', 'The king was surrounded by sycophants.'],
  ['taciturn', 'adj.', 'reserved or uncommunicative in speech', 'The taciturn farmer nodded once.'],
  ['tenacious', 'adj.', 'holding firmly; persistent', 'A tenacious reporter pursued the story for years.'],
  ['tenuous', 'adj.', 'very weak or slight', 'The link between the events is tenuous.'],
  ['trepidation', 'n.', 'a feeling of fear about something that may happen', 'She opened the letter with trepidation.'],
  ['truculent', 'adj.', 'eager to argue or fight; aggressively defiant', 'The truculent teenager slammed the door.'],
  ['ubiquitous', 'adj.', 'present or found everywhere', 'Smartphones are now ubiquitous.'],
  ['unctuous', 'adj.', 'excessively flattering or ingratiating', 'The salesman\'s unctuous manner put us off.'],
  ['untenable', 'adj.', 'not able to be defended or maintained', 'His position became untenable.'],
  ['vacillate', 'v.', 'to waver between different opinions', 'She vacillated between the two offers.'],
  ['venerate', 'v.', 'to regard with great respect', 'The village venerates its founder.'],
  ['veracity', 'n.', 'conformity to facts; accuracy', 'The veracity of the report is in doubt.'],
  ['verbose', 'adj.', 'using more words than needed', 'The verbose manual ran to 400 pages.'],
  ['vicarious', 'adj.', 'experienced through the feelings or actions of another', 'He took vicarious pleasure in her success.'],
  ['vindicate', 'v.', 'to clear of blame; show to be right', 'The results vindicated her theory.'],
  ['vociferous', 'adj.', 'expressing opinions loudly and forcefully', 'Vociferous protesters filled the square.'],
  ['volatile', 'adj.', 'liable to change rapidly and unpredictably', 'The market has been volatile all week.'],
  ['wary', 'adj.', 'feeling or showing caution about possible dangers', 'Be wary of unsolicited emails.'],
  ['zealous', 'adj.', 'having great energy or enthusiasm for a cause', 'Zealous volunteers worked through the night.'],
];

export default function (root) {
  const s = store('vocab-builder');
  let cards = s.get('cards', {}); // word -> {ef, interval, reps, due, lapses}
  let mode = s.get('mode', 'wotd');
  const view = el('div');
  const tabs = el('div', { class: 'row' });
  const dayNum = Math.floor(Date.now() / 86400000);
  const wotd = WORDS[((dayNum % WORDS.length) + WORDS.length) % WORDS.length];
  const todayStr = today();

  function card(w) { return cards[w] || { ef: 2.5, interval: 0, reps: 0, due: '', lapses: 0 }; }
  function dueCards() { return WORDS.filter(w => { const c = cards[w[0]]; return c && c.due && c.due <= todayStr; }); }
  function newCards() { return WORDS.filter(w => !cards[w[0]]); }
  function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
  function grade(word, q) { // SM-2
    const c = card(word);
    if (q < 3) { c.reps = 0; c.interval = q === 0 ? 0 : 1; c.lapses++; }
    else { if (c.reps === 0) c.interval = 1; else if (c.reps === 1) c.interval = 6; else c.interval = Math.round(c.interval * c.ef); c.reps++; }
    c.ef = Math.max(1.3, c.ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
    c.due = addDays(c.interval); cards[word] = c; s.set('cards', cards);
  }
  function wordBlock(w, big = false) {
    return el('div', {}, el('div', { class: big ? 'big' : '', style: { fontWeight: 700, fontSize: big ? '34px' : '20px' } }, w[0], ' ', el('span', { class: 'muted small', style: { fontWeight: 400 } }, w[1])), el('div', { style: { marginTop: '6px' } }, w[2]), el('div', { class: 'muted', style: { fontStyle: 'italic', marginTop: '4px' } }, '“' + w[3] + '”'));
  }

  // ----- word of the day -----
  function showWotd() {
    const learned = Object.keys(cards).length;
    const q = el('input', { class: 'input', placeholder: 'Search words…', oninput: () => { const t = q.value.trim().toLowerCase(); render(list, WORDS.filter(w => !t || w[0].includes(t) || w[2].includes(t)).slice(0, 40).map(w => el('li', {}, el('div', { class: 'grow' }, el('b', {}, w[0]), ' ', el('span', { class: 'muted small' }, w[1]), ' — ', w[2]), cards[w[0]] ? el('span', { class: 'badge ' + (cards[w[0]].reps >= 3 ? 'ok' : '') }, cards[w[0]].reps >= 3 ? 'known' : 'learning') : null))); } });
    const list = el('ul', { class: 'list' });
    render(view,
      el('div', { class: 'panel', style: { padding: '20px' } }, el('div', { class: 'small muted' }, 'Word of the day · ' + todayStr), wordBlock(wotd, true),
        el('div', { class: 'row' }, el('button', { class: 'btn small', onclick: () => { grade(wotd[0], 4); toast('Added to your review deck'); showWotd(); } }, cards[wotd[0]] ? 'In your deck ✓' : 'Add to flashcards'))),
      el('div', { class: 'row' }, stat(WORDS.length, 'words'), stat(learned, 'in your deck'), stat(dueCards().length, 'due today'), stat(Object.values(cards).filter(c => c.reps >= 3).length, 'known')),
      q, list);
    q.dispatchEvent(new Event('input'));
  }

  // ----- flashcards -----
  function showFlash() {
    let queue = shuffle(dueCards()); let fresh = newCards(); let done = 0;
    const box = el('div');
    function nextCard() {
      let w = queue.shift(); let isNew = false;
      if (!w) { if (fresh.length) { w = fresh.shift(); isNew = true; } else { render(box, el('div', { class: 'panel center', style: { textAlign: 'center', padding: '30px' } }, el('div', { class: 'big' }, 'All done'), el('div', { class: 'muted' }, 'Reviewed ' + done + ' cards. Come back tomorrow for the next batch.'))); return; } }
      let flipped = false;
      const front = el('div', { class: 'panel', style: { padding: '28px', textAlign: 'center', cursor: 'pointer', minHeight: '150px' }, onclick: flip }, el('div', { class: 'small muted' }, isNew ? 'New word' : 'Review'), el('div', { style: { fontWeight: 700, fontSize: '34px' } }, w[0]), el('div', { class: 'muted small' }, w[1] + ' · click or press Space to reveal'));
      const buttons = el('div', { class: 'row', style: { justifyContent: 'center' } });
      function flip() { if (flipped) return; flipped = true; render(front, wordBlock(w, true)); front.style.cursor = 'default'; render(buttons, [['Again', 1, 'danger'], ['Hard', 3, ''], ['Good', 4, ''], ['Easy', 5, 'primary']].map(([label, q, cls], i) => el('button', { class: 'btn ' + cls, onclick: () => { grade(w[0], q); done++; if (q < 3) queue.push(w); nextCard(); } }, label, ' ', el('span', { class: 'kbd' }, i + 1)))); }
      front._flip = flip; front._buttons = buttons;
      render(box, el('div', { class: 'small muted' }, queue.length + ' due · ' + fresh.length + ' new remaining · ' + done + ' done'), front, buttons);
      box._front = front;
    }
    const onKey = e => { if (mode !== 'flash' || !root.isConnected) return; const f = box._front; if (!f) return; if (e.key === ' ' && e.target.tagName !== 'INPUT') { e.preventDefault(); f._flip(); } else if (/^[1-4]$/.test(e.key)) { const b = f._buttons.children[+e.key - 1]; if (b) b.click(); } };
    keyHandler = onKey;
    render(view, el('div', { class: 'muted small' }, 'SM-2 spaced repetition: rate how well you knew each word; easy words return after longer intervals, missed words come back tomorrow. Keys: Space to flip, 1–4 to rate.'), box);
    nextCard();
  }

  // ----- quiz -----
  function showQuiz() {
    let score = 0, total = 0, streak = 0; let best = s.get('quizBest', 0);
    const box = el('div'); const scoreRow = el('div', { class: 'row' });
    function stats() { render(scoreRow, stat(score + '/' + total, 'score'), stat(streak, 'streak'), stat(best, 'best streak')); }
    function ask() {
      const pool = Object.keys(cards).length >= 8 && Math.random() < 0.5 ? WORDS.filter(w => cards[w[0]]) : WORDS;
      const answer = pool[Math.floor(Math.random() * pool.length)];
      const byDef = Math.random() < 0.5;
      const others = shuffle(WORDS.filter(w => w !== answer)).slice(0, 3);
      const opts = shuffle([answer, ...others]);
      const optsBox = el('div', { class: 'col' });
      let answered = false;
      render(box, el('div', { class: 'panel', style: { padding: '20px' } },
        el('div', { class: 'small muted' }, byDef ? 'Which word means…' : 'What does this word mean?'),
        el('div', { style: { fontWeight: 700, fontSize: byDef ? '20px' : '30px', margin: '6px 0 12px' } }, byDef ? answer[2] : answer[0]),
        optsBox));
      render(optsBox, opts.map((o, i) => el('button', { class: 'btn', style: { textAlign: 'left', whiteSpace: 'normal' }, onclick: function () {
        if (answered) return; answered = true; total++;
        const right = o === answer;
        if (right) { score++; streak++; if (streak > best) { best = streak; s.set('quizBest', best); } } else streak = 0;
        [...optsBox.children].forEach((b, j) => { if (opts[j] === answer) { b.style.borderColor = 'var(--ok)'; b.style.color = 'var(--ok)'; } else if (j === i) { b.style.borderColor = 'var(--danger)'; b.style.color = 'var(--danger)'; } });
        if (cards[answer[0]]) grade(answer[0], right ? 4 : 2);
        box.append(el('div', { class: 'row' }, el('span', { class: 'muted small' }, '“' + answer[3] + '”'), el('button', { class: 'btn primary small', onclick: ask }, 'Next ›')));
        stats();
      } }, el('span', { class: 'kbd' }, i + 1), ' ', byDef ? o[0] : o[2])));
      box._opts = optsBox;
    }
    keyHandler = e => { if (mode !== 'quiz' || !root.isConnected || e.target.tagName === 'INPUT') return; if (/^[1-4]$/.test(e.key)) { const b = box._opts && box._opts.children[+e.key - 1]; if (b) b.click(); } else if (e.key === 'Enter') { const n = box.querySelector('.btn.primary'); if (n) n.click(); } };
    render(view, scoreRow, box); stats(); ask();
  }

  let keyHandler = null;
  const onKeydown = e => keyHandler && keyHandler(e);
  window.addEventListener('keydown', onKeydown);

  function setMode(m) {
    mode = m; s.set('mode', m); keyHandler = null;
    render(tabs, [['wotd', 'Word of the day'], ['flash', 'Flashcards (' + dueCards().length + ' due)'], ['quiz', 'Quiz']].map(([k, label]) => el('button', { class: 'btn ' + (mode === k ? 'primary' : ''), onclick: () => setMode(k) }, label)),
      el('button', { class: 'btn ghost small', onclick: () => { cards = {}; s.set('cards', {}); setMode(mode); } }, 'Reset deck'));
    if (m === 'wotd') showWotd(); else if (m === 'flash') showFlash(); else showQuiz();
  }
  render(root, tabs, view);
  setMode(mode);
  return () => window.removeEventListener('keydown', onKeydown);
}
