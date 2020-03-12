const _ = require('lodash');
const { getEmailAddress, getPhoneNumber } = require('../index');

async function extractContactInfo(driver) {
    let webContent = await driver.executeScript(`
        return document.body.innerText
    `);
    let emailAddresses = getEmailAddress(webContent);
    let phoneNumbers = getPhoneNumber(webContent);

    let { socialLinks, contactLinks } = await driver.executeScript(`
        const links = document.querySelectorAll('a');
        const socialSites = ['facebook.com','twitter.com','youtube.com','instagram.com','whatsapp.com','qq.com','wechat.com','tumblr.com','vk.com']
        const contactLinks = []
        const socialLinks = []
        for(let i=0; i<links.length; i++) {
            if(links[i].textContent.toLowerCase().includes('contact') || links[i].href.toLowerCase().includes('contact')) {
                contactLinks.push(links[i].href);
            }
            
            socialSites.map(site => {
                if(links[i].href.toLowerCase().includes(site)) socialLinks.push(links[i].href)
            });
        }
        return { socialLinks, contactLinks }
    `);

    // contactLinks = contactLinks.map(contactLink => {
    //     try {
    //         const url = new URL(contactLink);
    //         return `${url.protocol}//${url.hostname}${url.pathname}`;
    //     } catch (e) {
    //         return contactLink
    //     }
    //
    // });
    //
    // socialSites = socialSites.map(socialSite => {
    //     try {
    //         const url = new URL(socialSite);
    //         return `${url.protocol}//${url.hostname}${url.pathname}`;
    //     } catch (e) {
    //         return socialSite
    //     }
    // });

    contactLinks = _.uniq(contactLinks);
    socialLinks = _.uniq(socialLinks);

    for(let i=0; i<contactLinks.length; i++) {
       await driver.get(contactLinks[i]);
       webContent = await driver.executeScript(`
        return document.body.innerText
       `);
       emailAddresses = [...emailAddresses, ...getEmailAddress(webContent)];
       phoneNumbers = [...phoneNumbers, ...getPhoneNumber(webContent)];
    }

    emailAddresses = _.uniq(emailAddresses);
    phoneNumbers = _.uniq(phoneNumbers);

    return { emailAddresses, phoneNumbers, socialLinks }
}

module.exports = {
    extractContactInfo
};
