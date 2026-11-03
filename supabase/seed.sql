-- Výchozí obsah platformy: šablona checklistu a kategorie rozpočtu.
-- offset_days = počet dní vůči datu svatby (záporné = před svatbou).

insert into public.checklist_template_items (title, offset_days, sort) values
  ('{"cs":"Stanovit celkový rozpočet a kdo co platí","en":"Set the total budget and who pays for what"}', -400, 10),
  ('{"cs":"Sestavit první seznam hostů","en":"Draft the guest list"}',                                   -390, 20),
  ('{"cs":"Vybrat a rezervovat místo obřadu a hostiny","en":"Book the ceremony and reception venue"}',   -365, 30),
  ('{"cs":"Rezervovat fotografa","en":"Book the photographer"}',                                       -330, 40),
  ('{"cs":"Vybrat oddávajícího a zajistit termín na úřadě","en":"Arrange the officiant and the registry date"}', -330, 50),
  ('{"cs":"Rezervovat catering","en":"Book the caterer"}',                                             -300, 60),
  ('{"cs":"Rezervovat hudbu (DJ nebo kapela)","en":"Book the music (DJ or band)"}',                   -270, 70),
  ('{"cs":"Založit svatební web","en":"Create the wedding website"}',                                 -270, 80),
  ('{"cs":"Vybrat svatební šaty","en":"Choose the wedding dress"}',                                    -240, 90),
  ('{"cs":"Zajistit ubytování pro hosty","en":"Arrange guest accommodation"}',                        -210, 100),
  ('{"cs":"Objednat svatební oznámení","en":"Order the wedding invitations"}',                         -180, 110),
  ('{"cs":"Rezervovat květinovou výzdobu","en":"Book the florist"}',                                  -180, 120),
  ('{"cs":"Vybrat oblek pro ženicha","en":"Choose the groom''s suit"}',                               -150, 130),
  ('{"cs":"Rozeslat oznámení s odkazem na web","en":"Send the invitations with the website link"}',    -120, 140),
  ('{"cs":"Objednat svatební dort","en":"Order the wedding cake"}',                                   -120, 150),
  ('{"cs":"Vybrat snubní prsteny","en":"Choose the wedding rings"}',                                  -90, 160),
  ('{"cs":"Domluvit kadeřnici a vizážistku","en":"Book hair and make-up"}',                          -90, 170),
  ('{"cs":"Odevzdat doklady na matriku","en":"Submit documents to the registry office"}',             -60, 180),
  ('{"cs":"Připomenout se hostům, kteří neodpověděli","en":"Remind guests who have not replied"}',    -45, 190),
  ('{"cs":"Uzavřít RSVP a poslat počty cateringu","en":"Close RSVP and send numbers to the caterer"}', -30, 200),
  ('{"cs":"Dokončit zasedací pořádek","en":"Finish the seating plan"}',                              -21, 210),
  ('{"cs":"Sestavit harmonogram dne D a sdílet ho s dodavateli","en":"Build the wedding-day schedule and share it with vendors"}', -14, 220),
  ('{"cs":"Doplatit zálohy dodavatelům","en":"Pay remaining vendor deposits"}',                       -14, 230),
  ('{"cs":"Vytisknout QR kartičky galerie na stoly","en":"Print gallery QR cards for the tables"}',   -7, 240),
  ('{"cs":"Připravit obálky s platbami pro dodavatele","en":"Prepare payment envelopes for vendors"}', -2, 250),
  ('{"cs":"Užít si svatbu","en":"Enjoy your wedding"}',                                               0, 260),
  ('{"cs":"Poslat hostům poděkování","en":"Send thank-you notes to guests"}',                          30, 270),
  ('{"cs":"Stáhnout všechny fotky z galerie","en":"Download all photos from the gallery"}',            120, 280);

update public.checklist_template_items set category = case title ->> 'cs'
    when 'Stanovit celkový rozpočet a kdo co platí' then 'planning'
    when 'Sestavit první seznam hostů' then 'guests'
    when 'Vybrat a rezervovat místo obřadu a hostiny' then 'vendors'
    when 'Rezervovat fotografa' then 'vendors'
    when 'Vybrat oddávajícího a zajistit termín na úřadě' then 'ceremony'
    when 'Rezervovat catering' then 'vendors'
    when 'Rezervovat hudbu (DJ nebo kapela)' then 'vendors'
    when 'Založit svatební web' then 'web'
    when 'Vybrat svatební šaty' then 'attire'
    when 'Zajistit ubytování pro hosty' then 'guests'
    when 'Objednat svatební oznámení' then 'guests'
    when 'Rezervovat květinovou výzdobu' then 'vendors'
    when 'Vybrat oblek pro ženicha' then 'attire'
    when 'Rozeslat oznámení s odkazem na web' then 'guests'
    when 'Objednat svatební dort' then 'vendors'
    when 'Vybrat snubní prsteny' then 'attire'
    when 'Domluvit kadeřnici a vizážistku' then 'vendors'
    when 'Odevzdat doklady na matriku' then 'ceremony'
    when 'Připomenout se hostům, kteří neodpověděli' then 'guests'
    when 'Uzavřít RSVP a poslat počty cateringu' then 'guests'
    when 'Dokončit zasedací pořádek' then 'guests'
    when 'Sestavit harmonogram dne D a sdílet ho s dodavateli' then 'day'
    when 'Doplatit zálohy dodavatelům' then 'vendors'
    when 'Vytisknout QR kartičky galerie na stoly' then 'day'
    when 'Připravit obálky s platbami pro dodavatele' then 'day'
    when 'Užít si svatbu' then 'day'
    when 'Poslat hostům poděkování' then 'guests'
    when 'Stáhnout všechny fotky z galerie' then 'day'
  end;

insert into public.budget_template_categories (name, share, sort) values
  ('{"cs":"Místo konání","en":"Venue"}',               0.20, 10),
  ('{"cs":"Catering a nápoje","en":"Catering and drinks"}', 0.30, 20),
  ('{"cs":"Foto a video","en":"Photo and video"}',      0.12, 30),
  ('{"cs":"Šaty a oblek","en":"Attire"}',               0.08, 40),
  ('{"cs":"Hudba","en":"Music"}',                       0.06, 50),
  ('{"cs":"Květiny a dekorace","en":"Flowers and decor"}', 0.07, 60),
  ('{"cs":"Prsteny","en":"Rings"}',                     0.05, 70),
  ('{"cs":"Dort a sladký bar","en":"Cake and dessert"}', 0.03, 80),
  ('{"cs":"Oznámení a tiskoviny","en":"Stationery"}',   0.02, 90),
  ('{"cs":"Doprava","en":"Transport"}',                 0.02, 100),
  ('{"cs":"Ubytování","en":"Accommodation"}',           0.03, 110),
  ('{"cs":"Ostatní","en":"Other"}',                     0.02, 120);
