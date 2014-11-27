GamesLT RSS? Kas tai?
--------------------
Šio projektėlio idėja - sukurti papildomus RSS srautus [Games.lt](http://games.lt) tinklalapiui, nes paprasčiausiai dabartiniams savininkams tai nėra įdomu, bet vartotojams taip.

Konfiguracija
--------------------

Duomenys saugomi MySQL duomenų bazėje, kurios prisijungimai nurodomi include/constants.php failiuke. Visos reikiamos lentelės sukūriamos, rašant duomenis pirmą kartą.

Veikimas
--------------------
Pagal nutylėjimą vykdomas RSS'o generavimas iš duomenų. Norint pasiimti duomenis reikia kreiptis per naršyklę į _index.php?action=fetch_ .

Licenzija? 
--------------------
[Public Domain](http://creativecommons.org/licenses/publicdomain/) :)

P.S.: naudojamoms trečių asmenų bibliotekoms galioja atskiros licenzijos!

Šiek tiek apie katalogus
--------------------
*   _libraries/_ kataloge sudėtos visos bibliotekos iš trečių šalių (joms galioja atskiros licenzijos, todėl pasidomėkite jomis patys).
*   _interfaces/_ skirtas PHP interfeisų aprašymams.
*   _include/_ - visi failai, kurie nėra aprašyti klasėmis ir nėra _index.php_ :) 
*   _fetchers/_ - visi duomenų pasiėmėjai iš skirtingų šaltinių (paskui, jų gauti duomenis įrašomi į lentelę). 
*   _class/_ - kelios naudojamos klasės. 
*   _action/_ - veiksmai, kurios gali atlikti šis įrankis (kol kas yra _rss_ bei _fetch_; pirmas parodo antras pasiima).
