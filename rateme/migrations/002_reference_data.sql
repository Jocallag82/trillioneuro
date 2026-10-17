-- Reference data needed in every environment (no businesses, no reviews).
set search_path = rateme, extensions, public;

insert into counties (slug, name, province) values
 ('carlow','Carlow','Leinster'),('dublin','Dublin','Leinster'),('kildare','Kildare','Leinster'),
 ('kilkenny','Kilkenny','Leinster'),('laois','Laois','Leinster'),('longford','Longford','Leinster'),
 ('louth','Louth','Leinster'),('meath','Meath','Leinster'),('offaly','Offaly','Leinster'),
 ('westmeath','Westmeath','Leinster'),('wexford','Wexford','Leinster'),('wicklow','Wicklow','Leinster'),
 ('clare','Clare','Munster'),('cork','Cork','Munster'),('kerry','Kerry','Munster'),
 ('limerick','Limerick','Munster'),('tipperary','Tipperary','Munster'),('waterford','Waterford','Munster'),
 ('galway','Galway','Connacht'),('leitrim','Leitrim','Connacht'),('mayo','Mayo','Connacht'),
 ('roscommon','Roscommon','Connacht'),('sligo','Sligo','Connacht'),
 ('cavan','Cavan','Ulster'),('donegal','Donegal','Ulster'),('monaghan','Monaghan','Ulster')
on conflict (slug) do nothing;

insert into localities (county_id, name, slug)
select c.id, l.name, l.slug from (values
 ('carlow','Carlow','carlow'),('carlow','Tullow','tullow'),('carlow','Bagenalstown','bagenalstown'),
 ('dublin','Dublin City','dublin-city'),('dublin','Dún Laoghaire','dun-laoghaire'),('dublin','Swords','swords'),
 ('dublin','Tallaght','tallaght'),('dublin','Blanchardstown','blanchardstown'),('dublin','Lucan','lucan'),
 ('dublin','Clondalkin','clondalkin'),('dublin','Balbriggan','balbriggan'),('dublin','Malahide','malahide'),
 ('dublin','Skerries','skerries'),('dublin','Dundrum','dundrum'),('dublin','Rathfarnham','rathfarnham'),
 ('dublin','Howth','howth'),('dublin','Stillorgan','stillorgan'),('dublin','Blackrock','blackrock'),
 ('kildare','Naas','naas'),('kildare','Newbridge','newbridge'),('kildare','Maynooth','maynooth'),
 ('kildare','Celbridge','celbridge'),('kildare','Leixlip','leixlip'),('kildare','Athy','athy'),('kildare','Kildare','kildare'),
 ('kilkenny','Kilkenny','kilkenny'),('kilkenny','Thomastown','thomastown'),('kilkenny','Castlecomer','castlecomer'),
 ('laois','Portlaoise','portlaoise'),('laois','Portarlington','portarlington'),('laois','Mountmellick','mountmellick'),
 ('longford','Longford','longford'),('longford','Granard','granard'),
 ('louth','Drogheda','drogheda'),('louth','Dundalk','dundalk'),('louth','Ardee','ardee'),
 ('meath','Navan','navan'),('meath','Ashbourne','ashbourne'),('meath','Trim','trim'),('meath','Kells','kells'),
 ('meath','Ratoath','ratoath'),('meath','Dunboyne','dunboyne'),('meath','Laytown','laytown'),
 ('offaly','Tullamore','tullamore'),('offaly','Birr','birr'),('offaly','Edenderry','edenderry'),
 ('westmeath','Athlone','athlone'),('westmeath','Mullingar','mullingar'),
 ('wexford','Wexford','wexford'),('wexford','Enniscorthy','enniscorthy'),('wexford','Gorey','gorey'),('wexford','New Ross','new-ross'),
 ('wicklow','Bray','bray'),('wicklow','Greystones','greystones'),('wicklow','Wicklow','wicklow'),('wicklow','Arklow','arklow'),
 ('clare','Ennis','ennis'),('clare','Shannon','shannon'),('clare','Kilrush','kilrush'),
 ('cork','Cork City','cork-city'),('cork','Ballincollig','ballincollig'),('cork','Carrigaline','carrigaline'),
 ('cork','Cobh','cobh'),('cork','Midleton','midleton'),('cork','Mallow','mallow'),('cork','Youghal','youghal'),
 ('cork','Bandon','bandon'),('cork','Clonakilty','clonakilty'),('cork','Kinsale','kinsale'),('cork','Fermoy','fermoy'),
 ('cork','Bantry','bantry'),('cork','Skibbereen','skibbereen'),
 ('kerry','Tralee','tralee'),('kerry','Killarney','killarney'),('kerry','Listowel','listowel'),('kerry','Kenmare','kenmare'),('kerry','Dingle','dingle'),
 ('limerick','Limerick City','limerick-city'),('limerick','Newcastle West','newcastle-west'),('limerick','Castletroy','castletroy'),('limerick','Kilmallock','kilmallock'),
 ('tipperary','Clonmel','clonmel'),('tipperary','Nenagh','nenagh'),('tipperary','Thurles','thurles'),
 ('tipperary','Carrick-on-Suir','carrick-on-suir'),('tipperary','Cashel','cashel'),('tipperary','Roscrea','roscrea'),('tipperary','Tipperary','tipperary'),
 ('waterford','Waterford City','waterford-city'),('waterford','Dungarvan','dungarvan'),('waterford','Tramore','tramore'),
 ('galway','Galway City','galway-city'),('galway','Tuam','tuam'),('galway','Ballinasloe','ballinasloe'),
 ('galway','Loughrea','loughrea'),('galway','Oranmore','oranmore'),('galway','Clifden','clifden'),
 ('leitrim','Carrick-on-Shannon','carrick-on-shannon'),('leitrim','Manorhamilton','manorhamilton'),
 ('mayo','Castlebar','castlebar'),('mayo','Ballina','ballina'),('mayo','Westport','westport'),('mayo','Claremorris','claremorris'),
 ('roscommon','Roscommon','roscommon'),('roscommon','Boyle','boyle'),('roscommon','Castlerea','castlerea'),
 ('sligo','Sligo','sligo'),('sligo','Tubbercurry','tubbercurry'),
 ('cavan','Cavan','cavan'),('cavan','Bailieborough','bailieborough'),('cavan','Virginia','virginia'),
 ('donegal','Letterkenny','letterkenny'),('donegal','Buncrana','buncrana'),('donegal','Donegal','donegal'),
 ('donegal','Ballyshannon','ballyshannon'),('donegal','Bundoran','bundoran'),
 ('monaghan','Monaghan','monaghan'),('monaghan','Carrickmacross','carrickmacross'),('monaghan','Castleblayney','castleblayney'),('monaghan','Clones','clones')
) l(county, name, slug) join counties c on c.slug = l.county
on conflict (county_id, slug) do nothing;

insert into categories (slug, name, description, sort_order) values
 ('trades-home-services','Trades & home services','Plumbers, electricians, builders, roofers and other trades.',10),
 ('automotive','Automotive','Garages, mechanics, NCT preparation, tyres and car sales.',20),
 ('restaurants-cafes','Restaurants & cafés','Restaurants, cafés, takeaways and bakeries.',30),
 ('health-personal-care','Health & personal care','Pharmacies, physiotherapy, dental and wellbeing services.',40),
 ('beauty-salons','Beauty & salons','Hair salons, barbers, beauty and nail studios.',50),
 ('retail','Retail','Shops and retailers of every kind.',60),
 ('professional-services','Professional services','Accountants, solicitors, consultants and agencies.',70),
 ('hospitality','Hospitality','Hotels, B&Bs, pubs and venues.',80),
 ('education-training','Education & training','Grinds, driving schools, tutors and training providers.',90),
 ('other-services','Other services','Cleaning, pet care, events and everything else.',100)
on conflict (slug) do nothing;

insert into categories (parent_id, slug, name, sort_order)
select p.id, s.slug, s.name, s.ord from (values
 ('trades-home-services','plumbers','Plumbers',1),('trades-home-services','electricians','Electricians',2),
 ('trades-home-services','builders','Builders',3),('trades-home-services','roofers','Roofers',4),
 ('trades-home-services','painters-decorators','Painters & decorators',5),('trades-home-services','carpenters','Carpenters',6),
 ('trades-home-services','landscapers','Landscapers & gardeners',7),('trades-home-services','heating-solar','Heating, heat pumps & solar',8),
 ('automotive','garages-mechanics','Garages & mechanics',1),('automotive','tyres','Tyres',2),('automotive','car-sales','Car sales',3),
 ('automotive','valeting','Valeting',4),('automotive','driving-recovery','Recovery & towing',5),
 ('restaurants-cafes','restaurants','Restaurants',1),('restaurants-cafes','cafes','Cafés',2),('restaurants-cafes','takeaways','Takeaways',3),('restaurants-cafes','bakeries','Bakeries',4),
 ('health-personal-care','pharmacies','Pharmacies',1),('health-personal-care','physiotherapy','Physiotherapy',2),
 ('health-personal-care','dentists','Dentists',3),('health-personal-care','opticians','Opticians',4),('health-personal-care','fitness','Gyms & fitness',5),
 ('beauty-salons','hair-salons','Hair salons',1),('beauty-salons','barbers','Barbers',2),('beauty-salons','beauty-nails','Beauty & nails',3),
 ('retail','clothing','Clothing',1),('retail','hardware','Hardware & DIY',2),('retail','grocery','Grocery & butchers',3),('retail','florists','Florists',4),('retail','electronics','Electronics & phone repair',5),
 ('professional-services','accountants','Accountants',1),('professional-services','solicitors','Solicitors',2),
 ('professional-services','estate-agents','Estate agents',3),('professional-services','marketing-web','Marketing & web design',4),('professional-services','insurance-brokers','Insurance & financial brokers',5),
 ('hospitality','hotels','Hotels',1),('hospitality','bnbs','B&Bs & guesthouses',2),('hospitality','pubs','Pubs & bars',3),('hospitality','venues','Event venues',4),
 ('education-training','grinds-tutors','Grinds & tutors',1),('education-training','driving-schools','Driving schools',2),('education-training','childcare','Childcare & crèches',3),('education-training','training-courses','Training & courses',4),
 ('other-services','cleaning','Cleaning',1),('other-services','pet-care','Pet care & grooming',2),('other-services','photography','Photography & video',3),
 ('other-services','removals-storage','Removals & storage',4),('other-services','events','Events & entertainment',5)
) s(parent, slug, name, ord) join categories p on p.slug = s.parent
on conflict (slug) do nothing;

insert into plans (code, name, description, amount_cents, currency, billing_interval, is_founding, active, sort_order) values
 ('founding-annual','RateMe Founding Member','Our introductory annual membership. Your price stays the same for as long as your membership renews without a break.',4999,'eur','year',true,true,1),
 ('standard-annual','RateMe Standard Member','Annual business membership.',7999,'eur','year',false,false,2)
on conflict (code) do nothing;

insert into settings (key, value) values
 ('membership', '{"grace_days": 14, "public_plan": "founding-annual"}'::jsonb),
 ('reviews', '{"max_reviews_per_ip_per_day": 6, "burst_threshold_per_business_per_hour": 8, "confirm_hours": 72}'::jsonb)
on conflict (key) do nothing;
