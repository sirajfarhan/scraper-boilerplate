const { writeData, getEmailAddress, getPhoneNumber, getWebsites } = require('../index');


const indices = ['%23','a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z'];


async function loadAllBrands(driver, categories) {
      let data = [];

      for(let i=0; i<categories.length; i++) {
          for (let j=0; j<indices.length; j++) {
            await driver.get(`https://www.amazon.co.uk/gp/search/other?ie=UTF8&pickerToList=brandtextbin&qid=1582725790:&indexField=a`);
            const brands = await driver.executeScript(`
                const brandLinks = document.querySelectorAll('.a-list-item > a')      
                const brands = []
                for(let i=0; i<brandLinks.length; i++) {
                    brands.push({ 
                        brandName: brandLinks[i].getAttribute('title'), 
                        url: brandLinks[i].href,
                        count: brandLinks[i].querySelector('.narrowValue').textContent.replace('(','').replace(')','').replace(/,/g,'').trim()
                    })
                } 
                return brands
            `);
            data = [...data, ...brands.map(brand => {
                brand.categoryName = categories[i].name;
                brand.categoryId = categories[i].node;
                return brand
            })];
          }
          await writeData('./data/brands.json', data);
      }
}

async function getSellerIds(driver, brands) {
    const ignoreCategories = ['Arts & Crafts', 'Automotive', 'Industrial & Scientific', 'Tools & Home Improvement']
    brands = brands.filter(brand => !ignoreCategories.includes(brand.categoryName))

    for (let i = 0; i < brands.length; i++) {
        await driver.get(brands[i].url)

        const seller = await driver.executeScript(`
                    el = Array.from(document.querySelectorAll('span'))
                         .find(el => el.textContent === 'Seller')
                    if(el) {
                        let seller = el.parentElement.nextElementSibling.querySelector('li')
                        if(!seller.id) {
                            seller = el.parentElement.nextElementSibling.querySelector('li').nextElementSibling
                        }
                        return { sellerName: seller.getAttribute('aria-label'), sellerId: seller.id.replace('p_6/','') }
                    } else {
                        return null
                    }
              `);
        brands[i] = {...brands[i], ...seller};
    }
    return brands
}

async function getSellerReviewSummary(driver) {
    try {
        return await driver.executeScript(`
                    const result = {}
                    const columnNames = ['30_days','90_days','365_days','lifetime'];
                    const rowNames = ['positive','neutral','negative','count'];
        
                    const summaryTable = document.querySelector('#feedback-summary-table').querySelectorAll('tr');
        
                    for(let i=1; i<5; i++) {
                        for(let j=1; j<5; j++) {
                              result[rowNames[i-1] + '_' + columnNames[j-1]] = summaryTable[i].querySelectorAll('td')[j].textContent.replace(/\\n/g,'').trim()
                        }
                    }
                    result.reviews_found = true;
                    return result 
    `);
    } catch (e) {
        return { reviews_found: false }
    }
}

async function isJustLaunched(driver) {
    try {
        return await driver.executeScript(`
            const feedbackSummary = document.querySelector('#seller-feedback-summary').textContent.toLowerCase();
            return feedbackSummary.includes('recién lanzado') || feedbackSummary.includes('just launched') || feedbackSummary.includes('soeben gestartet');
        `);
    } catch (e) {
        return false
    }
}

async function getLeads(driver, brands) {
    for (let i=0; i<brands.length; i++) {
        try {
            if(brands[i].sellerId) {
            await driver.get(`https://www.amazon.com/sp?seller=${brands[i].sellerId}`);
            const text = await driver.executeScript(`
                return document.body.innerText
            `);
            const emails = getEmailAddress(text);
            const numbers = getPhoneNumber(text);
            const websites = getWebsites(text);

            const result = await getSellerReviewSummary(driver);
            // await delay(2000);


                brands[i] = {...brands[i], emails, numbers, websites, ...result};
        }
        } catch (e) {
            console.log('ERROR', e)
        }

        if((i + 1) % 50 === 0) {
            await writeData('brands_with_info.json', brands)
            console.log('NOW', i);
        }

        if((i + 1) % 1000 === 0)
            break;
    }
}

function getAmazonUrlType(amazonUrl) {
    const url = new URL(amazonUrl);

    if(url.pathname.includes('/b') || url.pathname.includes('/l/') || url.pathname.includes('/pages/')) {
        return 'BRAND';
    }

    if(url.pathname.endsWith('/s')) {
        return 'CATEGORY_SEARCH';
    }

    if(url.pathname === '/s' || url.pathname === '/s/' || url.pathname.startsWith('/s/ref')) {
        return 'PRODUCT_SEARCH';
    }

    if(url.pathname.includes('/dp/')) {
        return 'PRODUCT';
    }

    if(url.pathname.includes('/e/')) {
        return 'AUTHOR';
    }

    if(url.pathname.includes('/stores')) {
        return 'BRAND_SELLER';
    }

    if(url.pathname.includes('/handmade')) {
        return 'HANDMADE_SELLER';
    }

    return 'MISC';
}

module.exports = {
    loadAllBrands, getSellerIds, getLeads, getSellerReviewSummary, isJustLaunched, getAmazonUrlType
}
