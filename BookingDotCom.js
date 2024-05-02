// ==UserScript==
// @name         Scraper for booking.com
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Scrapes room info for the searched dates
// @author       Yoon-Kit Yong
// @match        https://booking.com/hotel/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=whatsapp.com
// @grant        none
// @require      https://code.jquery.com/jquery-3.5.1.min.js#sha256-9/aliU8dGd2tb6OSsuzixeV4y/faTqgFtohetphbbj0=
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/yoonkit/booking.js
// @downloadURL  https://raw.githubusercontent.com/yoonkit/booking.js
// ==/UserScript==



var verbosity = 3
document.verbosity = verbosity

function ykAlert( msg, type=0 )
{
    /* Messages for debugging with varying degrees of reporting methods
     *     -1 : Boldify
     *      0 : console.log <Default>
     *      1 : light verbose
     *      2 : medium verbose
     *      3 : very verbose
     *     10 : window.alert (very annoying)
     * 230728 yky Created
	 * 230820 yky Modified - verbosity, caller function name, indent
     */
    if (type < 0) console.log( '*** ' + msg + ' ***' )
    else if (type == 10) window.alert( msg )
    else if (type <= document.verbosity)
    {
        let fname = ""
        let caller = ykAlert.caller
        if (caller != null) fname = ' (' + caller.name + ') '
        let spacer = "-".repeat(type*2) + ": "
        console.log( spacer + msg + fname );
    }
    return 0;
}

ykAlert('booking.com Scrape loading ...', 2)


function copyToClipboard(text) {
    var dummy = document.createElement("textarea");
    // to avoid breaking orgain page when copying more words
    // cant copy when adding below this code
    // dummy.style.display = 'none'
    document.body.appendChild(dummy);
    //Be careful if you use texarea. setAttribute('value', value), which works with "input" does not work with "textarea". – Eduard
    dummy.value = text;
    dummy.select();
    document.execCommand("copy");
    document.body.removeChild(dummy);
	ykAlert("Copied to Clipboard",1);
}

function toCSV(inputArray, separator = ",") {
	const mainCSV = inputArray.map(row => row.join(separator)).join('\n');
	return mainCSV
}


function create_UI() {
	var btncsv = document.createElement("Button");
	btncsv.innerHTML = "Find Rooms";
	btncsv.id = "findRooms"
	btncsv.onclick = function()
	{ 
		scrape_csv() 
		btnUpdate.click()
	}

	ava = document.getElementById("availability_target")
	ava.appendChild(btncsv)
	
	var btnclear = document.createElement("Button");
	btnclear.innerHTML = "Clear Memory";
	btnclear.id = "clearMemory"
	btnclear.onclick = function()
	{ 
		localStorage.bookingcom = localStorage.bookingcomlabels; 
		ykAlert("Cleared Memory") 
		btnUpdate.click()
	}
	ava.appendChild(btnclear)		
	
	var btncopy = document.createElement("Button");
	btncopy.innerHTML = "Copy to Clipboard";
	btncopy.onclick = function() { 
		copyToClipboard( localStorage.bookingcom )
		ykAlert("Copied " + localStorage.bookingcom.split("\n").length + " room details to clipboard") 
	}
	ava.appendChild(btncopy)	
	
	var btnUpdate = document.createElement("Button");
	btnUpdate.innerHTML = "Lines: ";
	btnUpdate.id = "updateLines"
	btnUpdate.onclick = function()
	{ 
		lines = localStorage.bookingcom.split("\n").length ; 
		ykAlert("Num Lines: " + lines, 1) 
		btnUpdate.textContent = "Num: " + lines
	}
	btnUpdate.click()
	
	ava.appendChild(btnUpdate)	
	
}

function decode_occupancy_config( occ ) {
	adults = occ.split("adult")
	if (adults.length > 1) {
		adult = parseInt( adults[0] )
	} else {
		ykAlert( "Cannot decypher number of adults", -1)
	}
	rooms = occ.split("room")
	if (rooms.length > 1) {
		rooms = rooms[0].split(" ")
		room = parseInt( rooms[ rooms.length-2 ] )
	} else {
		ykAlert( "Cannot decypher number of rooms", -1)
	}
	
	ykAlert("Adults = " + adult + " - Rooms = " + room, 5)
	
	return { adult:adult, room:room }
	//return [adult, room]
}

function decode_beds( description ) {
	
	let [single, double, twin, king, sofa, futon, pax ] = [0,0,0,0,0,0,0]
	
	description = description.replaceAll("\n","")
	if (description.indexOf("Bedroom") >= 0) {
		description = description.split(":")[1] // Bedroom 1: 2 double beds
	}
	
	descriptions = description.split("and ") 
	
	for (let descr of descriptions ) {
		
		description = descr
		
		quantity = description.replace(/\D/g, '')
		quantity = parseInt( "0"+quantity )

		if (description.indexOf("single bed")>0) {
			single += quantity
		} else if (description.indexOf("large double bed")>0) {
			king += quantity
		} else if (description.indexOf("double bed")>0) {
			double += quantity
		} else if (description.indexOf("queen bed")>0) {
			double += quantity
		} else if (description.indexOf("sofa bed")>0) {
			sofa += quantity
		} else if (description.indexOf("twin bed")>0) {
			twin += quantity
		} else if (description.indexOf("king bed")>0) {
			king += quantity
		} else if (description.indexOf("full bed")>0) {
			king += quantity
		} else if (description.indexOf("futon bed")>0) {
			futon += quantity
		} else if (description.indexOf("tatami")>0) {
			futon += quantity
		}

		pax = single + 2*double + 1*twin + 2*king + sofa + futon
		
	}
	
	return  { single:single, double:double, twin:twin, king:king, sofa:sofa, futon:futon, pax:pax }
	//return  [single, double, twin, king, sofa, futon, pax ]
}


function get_rooms(  ) {
	
	dt_sample = new Date()
	
	// Login Details
	genius_user = "anon"
	genius_level = 0
	login = document.querySelector('[data-testid="header-profile"]')
	if (login != null) {
		description = login.textContent.substr( 1 ) // skipping the first char
		details = description.split("Genius Level")
		
		genius_user = details[0]
		if (details.length>1) {	genius_level = parseInt( "0" + details[1].replace(/\D/g, '') ) }
		
		//login_name = login.getElementsByClassName("a3332d346a")
		//if (login_name.length>0) { genius_user = login_name[0].textContent }
		
	} 
	
	currency = document.querySelector('[data-testid="header-currency-picker-trigger"]')
	if (currency != null) {
		room_price_currency = currency.textContent
	} else {
		ykAlert("Could not find 'currency-picker'")
		room_price_currency = ""
	}
	
	
	// Search Query
	let [search_adult, search_room] = [0,0]
	let configs = document.querySelectorAll( "[data-testid='occupancy-config']")
	if (configs.length > 0) {
		let occ_config = configs[configs.length-1].textContent
		ykAlert( occ_config,4 )
		res_occ = decode_occupancy_config( occ_config )
		search_adult = res_occ.adult
		search_room = res_occ.room
		ykAlert( occ_config + ' = ' + [search_adult, search_room],1 )
	} else {
		ykAlert("Could not find 'occupancy-config' widget", -1)
	}
	
	let [dt_start, dt_end, dt_length] = [0,0,0]
	field_starts = document.querySelectorAll( '[data-testid="date-display-field-start"]')
	if (field_starts.length > 1) {
		dt_start = decode_bookingdate( field_starts[1].textContent )
	} else {
		ykAlert("Could not find 'field start' widget", -1)
	}
	
	field_ends = document.querySelectorAll( '[data-testid="date-display-field-end"]')
	if (field_ends.length > 1) {
		dt_end = decode_bookingdate( field_ends[1].textContent )
	} else {
		ykAlert("Could not find 'field end' widget", -1)
	}
	
	//dt_length = (new Date( (dt_end - dt_start) ).getDate()) - 1
	dt_length = day_diff( dt_start, dt_end )
	
	// Alerts - minimum nights
	
	alerts = document.querySelectorAll( "span.bui-alert__title")
	let room_minimumdays = 0
	if (alerts.length > 0) {
		for (let alert of alerts) {
			description = alert.textContent.replaceAll("\n","")
			
			if (description.indexOf("minimum length of stay") >= 0) {
				room_minimumdays = parseInt( "0" + description.replace(/\D/g, '') )
			}
		}
	}
	
	
	
	
	
	var result = []

	rooms = document.getElementsByClassName("js-rt-block-row")
	if (rooms.length > 0) {
		
		prop_name = document.title.split(" –")[0].replaceAll(",","")
		prop_url = document.URL
		prop_reviewscore = 0.0
		prop_limitedsupply_booked = 0
		
		reviewscore = document.querySelector( "div[data-testid='review-score-component']" ) 
		if (reviewscore != null) {
			prop_reviewscore = parseFloat( reviewscore.firstChild.textContent.split("Scored")[0] )
		}

		data_similar = document.querySelectorAll("[data-similar-unavailable]")
		if (data_similar.length > 0) {
			prop_limitedsupply_booked = data_similar[0].textContent.trim().replaceAll("\n","")
		}
		
		
		room_name = ""
		room_id = 0
		room_sqm = 0

		room_beds = 0
		room_beds_single = 0
		room_beds_double = 0

		room_scarcity = 0
		
		
		room_details = null
		
		
		for (let room of rooms) {
			
			if (room_details == null) { // set the first row of room types as details
				room_details = room
			}
			
			
			// Name and details
			id = room_details.querySelector("a[data-room-id]")
			if (id != null) {
				room_name = id.textContent.replaceAll("\n","") 
				room_id = id.attributes["data-room-id"].textContent
				ykAlert("Room: " + room_name, 6)
			}  

			scarce = room_details.querySelector("span.top_scarcity")
			if (scarce != null) {
				room_scarcity = parseInt( scarce.textContent.trim().replace(/\D/g, '') )
			} else {
				room_scarcity = 999
			}

			size = room_details.querySelector( "div[data-name-en='room size']" ) 
			if (size != null) {
				room_sqm = parseInt( size.textContent.split(" ")[0] )
			}
			
			facilities = room_details.querySelector( "div.hprt-facilities-block" )
			if (facilities != null) {
				room_facilities =  facilities.textContent.replaceAll("\n\n\n","; ").replaceAll("\n","").replaceAll(",","")
			} else {
				room_facilities = ""
			}			
			
			
			// Bedrooms and BedTypes
			let [ bed_single, bed_double, bed_twin, bed_king, bed_sofa, bed_futon, bed_pax ] = [0,0,0,0,0,0,0]
			// let [ single, double, twin, king, sofa, futon, pax ] = [0,0,0,0,0,0,0]
			let room_bedrooms = 0
			
			bedrooms = room_details.querySelectorAll( "li.bedroom_bed_type" ) // Apartment with multiple rooms
			if (bedrooms.length > 0 ) {
				for ( let bedroom of bedrooms ) {
					description = bedroom.textContent.replaceAll("\n"," ")
					if (description.indexOf("Bedroom")>=0) {
						room_bedrooms += 1
					} // Living Room out
					
					ykAlert( description, 9 )
					
					res = decode_beds(description)
					//[single, double, twin, king, sofa, futon, pax] = decode_beds(description)
					
					bed_single += res.single
					bed_double += res.double
					bed_twin += res.twin
					bed_king += res.king
					bed_sofa += res.sofa
					bed_futon += res.futon
					bed_pax += res.pax
					
					ykAlert( "Multiple room:" + description + " " +[bed_single, bed_double, bed_twin, bed_king, bed_sofa, bed_futon, bed_pax], 6 )
					
					//[ bed_single, bed_double, bed_twin, bed_king, bed_sofa, bed_futon, bed_pax ] = [ bed_single+single, bed_double+double, bed_twin+twin, bed_king+king, bed_sofa+sofa, bed_futon+futon, bed_pax+pax ]
				}
			} else {
			
				bed = room_details.querySelector( "li.rt-bed-type" ) // One Room with different beds
				if (bed != null ) {
					room_bedrooms = 1
					description = bed.textContent.replaceAll("\n"," ")
					
					ykAlert( description, 9 )
					
					res = decode_beds(description)
					// [single, double, twin, king, sofa, futon, pax] = decode_beds(description)

					
					bed_single += res.single
					bed_double += res.double
					bed_twin += res.twin
					bed_king += res.king
					bed_sofa += res.sofa
					bed_futon += res.futon
					bed_pax += res.pax

					ykAlert( "Single room:" + description + [bed_single, bed_double, bed_twin, bed_king, bed_sofa, bed_futon, bed_pax], 6 )
					
					//bed_single += single
					//bed_double += double
					//bed_twin += twin
					//bed_king += king
					//bed_sofa += sofa
					//bed_futon += futon
					//bed_pax += pax
					
					//[ bed_single, bed_double, bed_twin, bed_king, bed_sofa, bed_futon, bed_pax ] = [ bed_single+single, bed_double+double, bed_twin+twin, bed_king+king, bed_sofa+sofa, bed_futon+futon, bed_pax+pax ]
				}
			}
			
			if (room_bedrooms == 0) {
				room_bedrooms = 1
			}
			
			// Number of guests
					
			room_guests = parseInt( room.querySelector( "span.bui-u-sr-only" ).textContent.replace(/\D/g, '') )  // "Max Persons: 2"
			
			
			// Pricing
			
			room_price = 0
			room_totprice = 0
			
			price = room.querySelector( "div.bui-price-display__value" )
			if (price != null) {
				if (room_price_currency == "") {
					room_price_currency = price.textContent.trim().replaceAll(",","").replace(/\w/g, '')
				}
				room_totprice = parseFloat( price.textContent.replace(/\D/g, '')  )
				room_price = room_totprice / dt_length
			} else {
				ykAlert( " No room pricing found", -1)
			}
			
			original = room.querySelector( "div.bui-price-display__original" )
			if (original != null) {
				room_price_original = parseFloat( original.attributes["data-strikethrough-value"].textContent )
			} else {
				room_price_original = room_price
			}
			
			room_tax = 0
			room_tottax = 0
			tax = room.querySelector( "div.prd-taxes-and-fees-under-price" )
			if (tax != null) {
				if ( tax.textContent.indexOf("Includes") >= 0 ){
					room_tax = 0
				} else {
					room_tottax = parseFloat( tax.attributes["data-excl-charges-raw"].textContent )
					room_tax = room_tottax / dt_length
				}
			}  

			// Discounts
			
			discounts = room.querySelectorAll("span[data-bui-component='Popover']")
			room_discountpct = 0.0
			room_deal = ""
			room_credits = 0
			
			if (discounts.length > 0) {
				
				for (let discount of discounts) 
				{
					if ("aria-label" in discount.attributes) {
						description = discount.attributes["aria-label"].textContent.replace("..", "")
					} else description = discount.textContent.trim()
					
					if (description.indexOf("multiple deals and benefits") >= 0) {
						room_discountpct = parseFloat( description.split("% off")[0] )
					} else if (description.indexOf("Early Booker Deal") >= 0) {
						room_discountpct = parseFloat( description.split("% off")[0] )
					} else if (description.indexOf("Getaway Deal.") >= 0) {
						room_deal = description.split("between ")[1]
					} else if (description.indexOf("Credits") >= 0) {
						room_credits = description.replace(/\D/g, '')
					}
				}
			}
			
			/*
			bfast = room.querySelector( "svg.-streamline-food_coffee" )
			if (bfast != null) {
				
				bfasttext = bfast.parentNode.parentNode.textContent.trim()
				if ( bfasttext.indexOf("included") > 0) {
					room_bfast = true
					room_bfastpricepax = 0
				} else if ( bfasttext.indexOf("¥") > 0) {
					room_bfast = false
					room_bfastpricepax = parseFloat( bfasttext.replace(/\D/g, '') )
					//room_bfastpricepax = parseFloat( bfasttext.split("¥")[1].replaceAll(",","") )
				}
			} else {
				room_bfast = false
				room_bfastpricepax = 0
			}*/
			
			// Conditions
			
			conditions = room.querySelectorAll( "li.bui-list__item" )
			room_remaining = 999
			room_reschedule = false
			room_refundable = false
			room_refundablewindow = -1
			room_freecancel = false
			room_cancelby = 0
			room_cancelwindow = -1
			room_paynothing = false
			room_paynothingby = 0
			room_paynothingwindow = -1
			room_geniusdiscount = 0
			room_prepayment = true
			room_bfast = false
			room_bfastpricepax = 0
			
			for (let condition of conditions) {
				description = condition.textContent.trim()
				
				if (description.indexOf("reschedule") >= 0) {
					room_reschedule = true
				} else if (description.indexOf("Non-refundable") >= 0) {
					room_refundable = false
				} else if (description.indexOf("Pay in advance") >= 0) {
					room_paynothing = false
				} else if (description.indexOf("Genius discount") >= 0) {
					room_geniusdiscount = parseFloat( description.replace(/\D/g, '') )
				} else if (description.indexOf(" left on our site") >= 0) {
					room_remaining = parseInt( description.replace(/\D/g, '') )
				} else if (description.indexOf("Free cancellation") >= 0) {
					room_refundable = true
					room_freecancel = true
					room_cancelby =  decode_bookingdate ( description.split("before ")[1] )
					room_cancelwindow = day_diff( dt_start, room_cancelby )
				} else if (description.indexOf("Pay nothing until") >= 0) {
					room_refundable = true
					room_paynothing = true
					room_paynothingby =  decode_bookingdate ( description.split("until ")[1] )
					room_paynothingwindow = day_diff( dt_start, room_paynothingby )
				} else if (description.indexOf("No prepayment needed") >= 0) {
					room_paynothing = true
					roon_paynothingby = dt_start
					room_paynothingwindow = 0
					room_prepayment = false
					room_refundable = true
				} else if (description.indexOf("breakfast") >= 0) {
					room_bfast = description.indexOf("included") >= 0
					if (!room_bfast) {
						room_bfastpricepax = parseFloat( description.replace(/\D/g, '') )
					}
					
				}
				
				if (room_refundable) { 
					room_refundablewindow = Math.min( 
						(room_cancelwindow<0)?100:room_cancelwindow , 
						(room_paynothingwindow<0)?100:room_paynothingwindow	
						)
				}
				
			}
			
			/*
			remaining = room.querySelector( "li.bui-text--color-destructive-dark > div > div.bui-list__description")
			if (remaining != null) {
				room_remaining = parseInt( remaining.textContent.replace(/\D/g, '') )
			} else {
				room_remaining = 999
			}
			
			
			reshedule = room.querySelector( "li.bui-text--color-constructive > div > div.bui-list__description")
			if ( (reshedule != null) && (reshedule.textContent.indexOf("reschedule")>0) ){
				room_reschedule = true
			} else {
				room_reschedule = false
			}
			*/
						
			
			
			
			
			room_kitchen = room_details.querySelector( "span[data-name-en='Kitchen']" ) != null		
			room_kitchenprivate = room_details.querySelector( "svg.-streamline-oven" ) != null		
			room_ensuite = room_details.querySelector( "svg.-streamline-shower" ) != null		
			room_washingmachine = room_details.querySelector( "span[data-name-en='Washing machine']" ) != null		
			room_tumbledryer = room_details.querySelector( "span[data-name-en='Tumble dryer (machine)']" ) != null	
			room_view = room_details.querySelector( "svg.-streamline-mountains" ) != null
			room_balcony = room_details.querySelector( "svg.-streamline-resort" ) != null
			
			
			result.push( 
			[  prop_name, room_name, room_sqm,  room_guests, room_price,  dt_start, room_discountpct, room_geniusdiscount, room_deal, room_credits, room_bfast, room_bfastpricepax, room_minimumdays, room_remaining, room_reschedule, room_refundable, room_refundablewindow, room_freecancel, room_cancelwindow, room_paynothing, room_paynothingwindow, room_bedrooms, bed_single, bed_double, bed_twin, bed_king, bed_sofa, bed_futon, bed_pax, room_scarcity, room_tax, room_kitchenprivate, room_kitchen, room_ensuite, room_washingmachine, room_tumbledryer, room_view, room_balcony, room_id,  prop_reviewscore, prop_limitedsupply_booked, room_price_currency, dt_sample, search_adult, search_room, dt_length, genius_user, genius_level, room_totprice, room_tottax, dt_end, room_facilities, room_cancelby,  room_paynothingby,  prop_url,
			] )
			
			ykAlert("Room: " + room_name + " - price: " + room_price_currency + " " + room_price.toLocaleString() + " (" + room_discountpct + "%) pax: (" + room_guests + "," + bed_pax + ") refunddays: " + room_refundablewindow , 2)
			
			if (room.classList.contains("hprt-table-last-row")) {
				// Reset the carry forward for the room class
				room_name = ""
				room_id = 0
				room_sqm = 0
				room_beds = 0
				room_beds_single = 0
				room_beds_double = 0
				room_scarcity = 0	
				room_details = null
			}
		}
		
		ykAlert("Found " + result.length + " rooms", 1 )
	} else {
		ykAlert("No Rooms Found", -1)
	}
	
	return result
}

function decode_bookingdate( dt ) {
	// looks like 'Fri 14 Feb'
	
	today = new Date()
	parsed = new Date( Date.parse( dt + ' ' + today.getFullYear().toString() ) )
	
	if (parsed < today) {
		parsed.setFullYear( parsed.getFullYear() +1 )		
	}
	
	return parsed
}

function day_diff( a, b ) {
	if (b > a) {
		c = b-a
	} else {
		c = a-b
	}
	
	return (new Date( c ).getDate()) - 1
}

function get_dates( step=0 )
{
	step += 1
	
	field_starts = document.querySelectorAll( '[data-testid="date-display-field-start"]')
	if (field_starts.length > 1) {
		dt_start =  field_starts[1] 
	} else {
		ykAlert("Could not find 'field start' widget", -1)
	}
	
	if (step==1) {
		field_start.click()
		setTimeout( function() { get_dates( step ) }, 1500 )
		// call again
		
		return null	
	}
	
	cells  = document.querySelectorAll( 'span[data-date]')
	if (cells.length > 0) {
		roll_amount = 0
		roll_date = ''
		page_amount = 0
		
		page_date = document.querySelector( 'span.e4862a187f') // highlighted date
		
		
		
	}
		
	
	return cells
}

function scrape_csv() 
{
	ykAlert("Scraping")
	
	result = get_rooms( )
	
	result_csv = toCSV( result, '\t' )
	//copyToClipboard( result_csv )
	
	//if (localStorage.bookingcomlabels == null) {
		labels = "prop_name, room_name, room_sqm,  room_guests, room_price,  dt_start, room_discountpct, room_geniusdiscount, room_deal, room_credits, room_bfast, room_bfastpricepax, room_minimumdays, room_remaining, room_reschedule, room_refundable, room_refundablewindow, room_freecancel, room_cancelwindow, room_paynothing, room_paynothingwindow, room_bedrooms, bed_single, bed_double, bed_twin, bed_king, bed_sofa, bed_futon, bed_pax, room_scarcity, room_tax, room_kitchenprivate, room_kitchen, room_ensuite, room_washingmachine, room_tumbledryer, room_view, room_balcony, room_id,  prop_reviewscore, prop_limitedsupply_booked, room_price_currency, dt_sample, search_adult, search_room, dt_length, genius_user, genius_level, room_totprice, room_tottax, dt_end, room_facilities, room_cancelby,  room_paynothingby,  prop_url".replaceAll(",","\t")
		localStorage.bookingcomlabels = labels
	//}
	
	stored = localStorage.bookingcom
	stored = stored + "\n" + result_csv
	localStorage.bookingcom = stored
	//copyToClipboard( stored )
	
}

function setup() {
	create_UI()
	if (localStorage.bookingcom == null) localStorage.bookingcom = ""
}

setup()


