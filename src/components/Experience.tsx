import { Plus } from "lucide-react";
import "./career.css";

const experiencesData = [
    {
      company: "Voicenter", role: "Technical Support Specialist Tier 2", period: "2023 - 2026",
      description: [
        "Collaborated with Development and DevOps teams using Jira to resolve issues and improve workflows",
        "Supported VIP and standard clients across the company's products",
        "Worked with API integrations, Kibana, networking, and Amazon Web Services (AWS)",
        "Tested features and servers at the request of Development and DevOps teams",
        "Co-developed a troubleshooting tool with the Development team",
        "Diagnosed and resolved live issues across servers using PRTG",
      ],
    },
    {
      company: "Voicenter", role: "Technical Support Specialist - Strategic Customers", period: "2021 - 2023",
      description: [
        "Provided technical support for telephone systems on the cloud",
        "Wrote guides and presentations, conducted apprenticeships, and administered exercises",
        "Managed the accounts of the largest clients on-site",
        "Worked with ASTERISK, SQL, alongside IT, engineering, and development departments",
      ],
    },
    {
      company: "Voicenter", role: "Technical Support Engineer Tier 1", period: "2021",
      description: [
        "Conducted analysis of current VoIP networks and computer systems",
        "Resolved VoIP network complications through troubleshooting",
        "Evaluated and enhanced network security measures and protocols",
        "Offered initial technical support to clients via calls, emails, or tickets",
      ],
    },
    {
      company: "ILDC", role: "Quality Assurance Tester", period: "2018 - 2021",
      description: [
        "Executed QA tests within Sagemcom LAB for Altice (HOT) company's products",
        "Performed daily quality assurance testing of set-top boxes to ensure adherence to standards",
      ],
    },
    {
      company: "IDF", role: "Military Service", period: "2015 - 2018",
      description: [
        "Performed vehicle treatments and utilized test equipment to ensure optimal functionality",
        "Removed and installed vehicle assemblies in accordance with established procedures",
      ],
    },
];

export default function Experience() {
  return (
    <section id="experience" className="career-section" aria-labelledby="experience-heading">
      <div className="career-inner career-split">
        <header className="career-heading">
          <p className="career-eyebrow">Career history</p>
          <h2 id="experience-heading">Where I’ve worked.</h2>
          <p>From hands-on quality assurance to Tier 2 support for cloud telephony and production systems.</p>
        </header>
        <ol className="career-timeline">
          {experiencesData.map(({ company, role, period, description }) => (
            <li key={role}>
              <details className="career-role">
                <summary>
                  <span className="career-role-period">{period.replace(" - ", " – ")}</span>
                  <span>
                    <span className="career-company">{company}</span>
                    <span className="career-role-title">{role}</span>
                  </span>
                  <Plus size={20} aria-hidden="true" />
                </summary>
                <ul>
                  {description.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </details>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
