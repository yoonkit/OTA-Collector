// ==UserScript==
// @name         Data Collector for booking.com
// @namespace    http://tampermonkey.net/
// @version      0.14
// @description  Extracts room info for the searched dates
// @author       Yoon-Kit Yong
// @match        https://www.booking.com/hotel/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=booking.com
// @grant        none
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/yoonkit/OTA-Collector/main/BookingDotCom.js
// @downloadURL  https://raw.githubusercontent.com/yoonkit/OTA-Collector/main/BookingDotCom.js
// ==/UserScript==



var verbosity = 3;
document.verbosity = verbosity;

function ykAlert( msg, type )
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
	 * 240502 yky Modified - caller crash on main call
     */
    if (type == null) type = 1
    if (type < 0) console.log( '*** ' + msg + ' ***' )
    else if (type == 10) window.alert( msg )
    else if (type <= document.verbosity)
    {
        let fname = ""
        let caller = null
        if (ykAlert.hasOwnProperty("caller")) caller = ykAlert.caller
        if (caller != null) fname = ' (' + caller.name + ') '
        let spacer = "-".repeat(type*2) + ": "
        console.log( spacer + msg + fname );
    }
    return 0;
}

ykAlert('booking.com Extractor loading ...', 2)


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

	ykAlert("Creating UI for booking.com collector",3)

    var div = document.createElement("div")
    div.style = "font-size:12px;"

	var btncsv = document.createElement("Button");
	btncsv.innerHTML = "Find Rooms";
	btncsv.id = "findRooms"
	btncsv.onclick = function()
	{
		extract_csv()
		btnUpdate.click()
	}

	div.appendChild(btncsv)

    var cbDiv = document.createElement("div")
    var cbIncludeHeader = document.createElement("INPUT")
    var cbText = document.createTextNode("Include Headers")
    cbIncludeHeader.setAttribute("type", "checkbox")
    cbIncludeHeader.id = "includeHeader"
    cbDiv.appendChild(cbIncludeHeader)
    cbDiv.appendChild(cbText)
	div.appendChild(cbDiv)

    var btncopy = document.createElement("Button");
	btncopy.innerHTML = "Copy to Clipboard";
	btncopy.onclick = function() {
        let content = localStorage.bookingcom
        if (cbIncludeHeader.checked) {
            content = localStorage.bookingcomlabels + "\n" + content;
        }
		copyToClipboard( content )
		ykAlert("Copied " + content.split("\n").length + " room details to clipboard")
	}
	div.appendChild(btncopy)

	var btnclear = document.createElement("Button");
	btnclear.innerHTML = "Clear Memory";
	btnclear.id = "clearMemory"
	btnclear.onclick = function()
	{
		localStorage.bookingcom = ""
		ykAlert("Cleared Memory")
		btnUpdate.click()
	}
	div.appendChild(btnclear)

	var btnUpdate = document.createElement("Button");
	btnUpdate.innerHTML = "Lines: ";
	btnUpdate.id = "updateLines"
	btnUpdate.onclick = function()
	{
		let lines = localStorage.bookingcom.split("\n").length ;
		ykAlert("Num Lines: " + lines, 1)
		btnUpdate.textContent = "Num: " + lines
	}
	btnUpdate.click()
	div.appendChild(btnUpdate)

	let ava = document.getElementById("availability_target")
    ava.appendChild(div)


}

function decode_occupancy_config( occ ) {
	let adults = occ.split("adult")
    let [adult, room] = [0,0]
	if (adults.length > 1) {
		adult = parseInt( "0" + adults[0] )
	} else {
		ykAlert( "Cannot decypher number of adults", -1)
	}
	let rooms = occ.split("room")
	if (rooms.length > 1) {
		rooms = rooms[0].split(" ")
		room = parseInt( "0"+rooms[ rooms.length-2 ] )
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

	let descriptions = description.split("and ")

	for (let descr of descriptions ) {
		description = descr
		let quantity = description.replace(/\D/g, '')
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

	return { single:single, double:double, twin:twin, king:king, sofa:sofa, futon:futon, pax:pax }
	//return  [single, double, twin, king, sofa, futon, pax ]
}


function get_rooms( ) {

	let dt_sample = new Date()
    let description = ""

	// Login Details
	let genius_user = "anon"
	let genius_level = 0
	let login = document.querySelector('[data-testid="header-profile"]')
	if (login != null) {
		let description = login.textContent.substr( 1 ) // skipping the first char
		let details = description.split("Genius Level")

		genius_user = details[0]
		if (details.length>1) {	genius_level = parseInt( "0" + details[1].replace(/\D/g, '') ) }

		//login_name = login.getElementsByClassName("a3332d346a")
		//if (login_name.length>0) { genius_user = login_name[0].textContent }
	}

	let currency = document.querySelector('[data-testid="header-currency-picker-trigger"]')
    let room_price_currency = ""
	if (currency != null) {
		room_price_currency = currency.textContent
	} else {
		ykAlert("Could not find 'currency-picker'")
	}

	// Search Query
	let [search_adult, search_room] = [0,0]
	let configs = document.querySelectorAll( "[data-testid='occupancy-config']")
	if (configs.length > 0) {
		let occ_config = configs[configs.length-1].textContent
		ykAlert( occ_config,4 )
		let res_occ = decode_occupancy_config( occ_config )
		search_adult = res_occ.adult
		search_room = res_occ.room
		ykAlert( occ_config + ' = ' + [search_adult, search_room],1 )
	} else {
		ykAlert("Could not find 'occupancy-config' widget", -1)
	}

	let [dt_start, dt_end, dt_length] = [0,0,0]
	let field_starts = document.querySelectorAll( '[data-testid="date-display-field-start"]')
	if (field_starts.length > 1) {
		dt_start = decode_bookingdate( field_starts[1].textContent )
	} else {
		ykAlert("Could not find 'field start' widget", -1)
	}

	let field_ends = document.querySelectorAll( '[data-testid="date-display-field-end"]')
	if (field_ends.length > 1) {
		dt_end = decode_bookingdate( field_ends[1].textContent )
	} else {
		ykAlert("Could not find 'field end' widget", -1)
	}

	dt_length = day_diff( dt_start, dt_end )

	// Alerts - minimum nights

	let alerts = document.querySelectorAll( "span.bui-alert__title")
	let room_minimumdays = 0
	if (alerts.length > 0) {
		for (let alert of alerts) {
			let description = alert.textContent.replaceAll("\n","")

			if (description.indexOf("minimum length of stay") >= 0) {
				room_minimumdays = parseInt( "0" + description.replace(/\D/g, '') )
			}
		}
	}

	var result = []

	let rooms = document.getElementsByClassName("js-rt-block-row")
	if (rooms.length > 0) {
		let prop_name = document.title.split(" –")[0].replaceAll(",","")
		let prop_url = document.URL
		let prop_reviewscore = 0.0
		let prop_limitedsupply_booked = 0

		let reviewscore = document.querySelector( "div[data-testid='review-score-component']" )
		if (reviewscore != null) {
			prop_reviewscore = parseFloat( reviewscore.firstChild.textContent.split("Scored")[0] )
		}

		let data_similar = document.querySelectorAll("[data-similar-unavailable]")
		if (data_similar.length > 0) {
			prop_limitedsupply_booked = data_similar[0].textContent.trim().replaceAll("\n","")
		}


		let room_name = ""
		let room_id = 0
		let room_sqm = 0

		let room_beds = 0
		let room_beds_single = 0
		let room_beds_double = 0

		let room_scarcity = 0

		let room_details = null
		for (let room of rooms) {

			if (room_details == null) { // set the first row of room types as details
				room_details = room
			}

			// Name and details
			let id = room_details.querySelector("a[data-room-id]")
			if (id != null) {
				room_name = id.textContent.replaceAll("\n","")
				room_id = id.attributes["data-room-id"].textContent
				ykAlert("Room: " + room_name, 6)
			}

			let scarce = room_details.querySelector("span.top_scarcity")
			if (scarce != null) {
				room_scarcity = parseInt( scarce.textContent.trim().replace(/\D/g, '') )
			} else {
				room_scarcity = 999
			}

			let size = room_details.querySelector( "div[data-name-en='room size']" )
			if (size != null) {
				room_sqm = parseInt( size.textContent.split(" ")[0] )
			}

            let room_facilities = ""
			let facilities = room_details.querySelector( "div.hprt-facilities-block" )
			if (facilities != null) {
				room_facilities = facilities.textContent.replaceAll("\n\n\n","; ").replaceAll("\n","").replaceAll(",","")
			}

			// Bedrooms and BedTypes
			let [ bed_single, bed_double, bed_twin, bed_king, bed_sofa, bed_futon, bed_pax ] = [0,0,0,0,0,0,0]
			// let [ single, double, twin, king, sofa, futon, pax ] = [0,0,0,0,0,0,0]
			let room_bedrooms = 0
			let bedrooms = room_details.querySelectorAll( "li.bedroom_bed_type" ) // Apartment with multiple rooms
			if (bedrooms.length > 0 ) {
				for ( let bedroom of bedrooms ) {
					description = bedroom.textContent.replaceAll("\n"," ")
					if (description.indexOf("Bedroom")>=0) {
						room_bedrooms += 1
					} // Living Room out

					ykAlert( description, 9 )

					let res = decode_beds(description)

					bed_single += res.single
					bed_double += res.double
					bed_twin += res.twin
					bed_king += res.king
					bed_sofa += res.sofa
					bed_futon += res.futon
					bed_pax += res.pax

					ykAlert( "Multiple room:" + description + " " +[bed_single, bed_double, bed_twin, bed_king, bed_sofa, bed_futon, bed_pax], 6 )
				}
			} else {

				let bed = room_details.querySelector( "li.rt-bed-type" ) // One Room with different beds
				if (bed != null ) {
					room_bedrooms = 1
					description = bed.textContent.replaceAll("\n"," ")

					ykAlert( description, 9 )
					let res = decode_beds(description)

					bed_single += res.single
					bed_double += res.double
					bed_twin += res.twin
					bed_king += res.king
					bed_sofa += res.sofa
					bed_futon += res.futon
					bed_pax += res.pax

					ykAlert( "Single room:" + description + [bed_single, bed_double, bed_twin, bed_king, bed_sofa, bed_futon, bed_pax], 6 )
				}
			}
			if (room_bedrooms == 0) {
				room_bedrooms = 1
			}
			// Number of guests
			let room_guests = parseInt( room.querySelector( "span.bui-u-sr-only" ).textContent.replace(/\D/g, '') ) // "Max Persons: 2"

			// Pricing
			let room_price = 0
			let room_totprice = 0

			let price = room.querySelector( "div.bui-price-display__value" )
			if (price != null) {
				if (room_price_currency == "") {
					room_price_currency = price.textContent.trim().replaceAll(",","").replace(/\w/g, '')
				}
				room_totprice = parseFloat( price.textContent.replace(/\D/g, '') )
				room_price = room_totprice / dt_length
			} else {
				ykAlert( " No room pricing found", -1)
			}

            let room_price_original = room_price
            let original = room.querySelector( "div.bui-price-display__original" )
			if (original != null) {
				room_price_original = parseFloat( original.attributes["data-strikethrough-value"].textContent )
			}

            let room_tax = 0
			let room_tottax = 0
			let tax = room.querySelector( "div.prd-taxes-and-fees-under-price" )
			if (tax != null) {
				if ( tax.textContent.indexOf("Includes") >= 0 ){
					room_tax = 0
				} else {
					room_tottax = parseFloat( tax.attributes["data-excl-charges-raw"].textContent )
					room_tax = room_tottax / dt_length
				}
			}

			// Discounts
			let discounts = room.querySelectorAll("span[data-bui-component='Popover']")
			let room_discountpct = 0.0
			let room_deal = ""
			let room_credits = 0
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

			// Conditions
			let conditions = room.querySelectorAll( "li.bui-list__item" )
			let room_remaining = 999
			let room_reschedule = false
			let room_refundable = false
			let room_refundablewindow = -1
			let room_freecancel = false
			let room_cancelby = 0
			let room_cancelwindow = -1
			let room_paynothing = false
			let room_paynothingby = 0
			let room_paynothingwindow = -1
			let room_geniusdiscount = 0
			let room_prepayment = true
			let room_bfast = false
			let room_bfastpricepax = 0

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
					room_cancelby = decode_bookingdate ( description.split("before ")[1] )
					room_cancelwindow = day_diff( dt_start, room_cancelby )
				} else if (description.indexOf("Pay nothing until") >= 0) {
					room_refundable = true
					room_paynothing = true
					room_paynothingby = decode_bookingdate ( description.split("until ")[1] )
					room_paynothingwindow = day_diff( dt_start, room_paynothingby )
				} else if (description.indexOf("No prepayment needed") >= 0) {
					room_paynothing = true
					room_paynothingby = dt_start
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

			let room_kitchen = room_details.querySelector( "span[data-name-en='Kitchen']" ) != null
			let room_kitchenprivate = room_details.querySelector( "svg.-streamline-oven" ) != null
			let room_ensuite = room_details.querySelector( "svg.-streamline-shower" ) != null
			let room_washingmachine = room_details.querySelector( "span[data-name-en='Washing machine']" ) != null
			let room_tumbledryer = room_details.querySelector( "span[data-name-en='Tumble dryer (machine)']" ) != null
			let room_view = room_details.querySelector( "svg.-streamline-mountains" ) != null
			let room_balcony = room_details.querySelector( "svg.-streamline-resort" ) != null

			result.push(
			[ prop_name, room_name, room_sqm, room_guests, room_price, dt_start, room_discountpct, room_geniusdiscount, room_deal, room_credits, room_bfast, room_bfastpricepax, room_minimumdays, room_remaining, room_reschedule, room_refundable, room_refundablewindow, room_freecancel, room_cancelwindow, room_paynothing, room_paynothingwindow, room_bedrooms, bed_single, bed_double, bed_twin, bed_king, bed_sofa, bed_futon, bed_pax, room_scarcity, room_tax, room_kitchenprivate, room_kitchen, room_ensuite, room_washingmachine, room_tumbledryer, room_view, room_balcony, room_id, prop_reviewscore, prop_limitedsupply_booked, room_price_currency, dt_sample, search_adult, search_room, dt_length, genius_user, genius_level, room_totprice, room_tottax, dt_end, room_facilities, room_cancelby, room_paynothingby, prop_url,
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
	let today = new Date()
	let parsed = new Date( Date.parse( dt + ' ' + today.getFullYear().toString() ) )

	if (parsed < today) {
		parsed.setFullYear( parsed.getFullYear() +1 )
	}
	return parsed
}

function day_diff( a, b ) {
    let c = 0
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

    let dt_start = 0

	let field_starts = document.querySelectorAll( '[data-testid="date-display-field-start"]')
	if (field_starts.length > 1) {
		dt_start = field_starts[1]
	} else {
		ykAlert("Could not find 'field start' widget", -1)
	}
	if (step==1) {
		field_starts.click()
		setTimeout( function() { get_dates( step ) }, 1500 )
		// call again

		return null
	}

	let cells = document.querySelectorAll( 'span[data-date]')
	if (cells.length > 0) {
		let roll_amount = 0
		let roll_date = ''
		let page_amount = 0

		let page_date = document.querySelector( 'span.e4862a187f') // highlighted date
	}
	return cells
}

function extract_csv()
{
	ykAlert("Scraping")

	let result = get_rooms( )
	let result_csv = toCSV( result, '\t' )

	let labels = "prop_name, room_name, room_sqm,  room_guests, room_price,  dt_start, room_discountpct, room_geniusdiscount, room_deal, room_credits, room_bfast, room_bfastpricepax, room_minimumdays, room_remaining, room_reschedule, room_refundable, room_refundablewindow, room_freecancel, room_cancelwindow, room_paynothing, room_paynothingwindow, room_bedrooms, bed_single, bed_double, bed_twin, bed_king, bed_sofa, bed_futon, bed_pax, room_scarcity, room_tax, room_kitchenprivate, room_kitchen, room_ensuite, room_washingmachine, room_tumbledryer, room_view, room_balcony, room_id,  prop_reviewscore, prop_limitedsupply_booked, room_price_currency, dt_sample, search_adult, search_room, dt_length, genius_user, genius_level, room_totprice, room_tottax, dt_end, room_facilities, room_cancelby,  room_paynothingby,  prop_url".replaceAll(",","\t")
	localStorage.bookingcomlabels = labels

    let stored = localStorage.bookingcom
    if (stored == "") stored = result_csv
    else stored = stored + '\n' + result_csv
	localStorage.bookingcom = stored
}

function setup() {
	create_UI()
	if (localStorage.bookingcom == null) localStorage.bookingcom = ""
	ykAlert("Welcome to booking.com Data collector",1)
}

setup()

var myMonkeys = window.myMonkeys = {};

myMonkeys.setup = function() { setup() }
