async function getJobsFromIndeed(driver) {
    const noOpenings = await driver.executeScript(`
       return document.body.innerText.includes('There are currently no open jobs')
    `);
    const jobs = await driver.executeScript(`
                const jobListSection = document.querySelector('.cmp-JobList-jobList');
                let jobs = []
                if(jobListSection) {
                    const jobList = [...jobListSection.querySelectorAll('li')];
                    jobs = jobList.map(job => {
                        const id = job.dataset.tnEntityid.split(',')[1]
                        const title = job.querySelector('.cmp-JobListItem-title').textContent
                        const city =  job.querySelector('.cmp-JobListItem-subtitle').textContent
                        const time = job.querySelector('.cmp-JobListItem-timeTag').textContent
                        return { id, title, city, time };
                    })
                }
                return jobs
    `);

    return { noOpenings, jobs };
}

module.exports = { getJobsFromIndeed };
