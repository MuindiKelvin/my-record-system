// Dashboard.js
import React, { useState, useEffect } from 'react';
import { collection, getDocs} from 'firebase/firestore';
import { db } from './firebase';

function Dashboard() {
  const [stats, setStats] = useState({
    totalProjects: 0,
    pendingProjects: 0,
    completedProjects: 0,
    totalAmount: 0,
    recentProjects: []
  });

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const projectsRef = collection(db, 'projects');
        const querySnapshot = await getDocs(projectsRef);
        
        let total = 0;
        let pending = 0;
        let completed = 0;
        let totalAmount = 0;
        const recent = [];

        querySnapshot.forEach(doc => {
          const project = { id: doc.id, ...doc.data() };
          total++;
          if (project.status === 'pending') pending++;
          if (project.status === 'completed') completed++;
          totalAmount += parseFloat(project.amount || 0);
          
          if (recent.length < 5) {
            recent.push(project);
          }
        });

        // Sort recent projects by date
        recent.sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate));

        setStats({
          totalProjects: total,
          pendingProjects: pending,
          completedProjects: completed,
          totalAmount: totalAmount,
          recentProjects: recent
        });
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      }
    };

    fetchDashboardData();
  }, []);

  return (
    <div className="container-fluid py-4">
      {/* Stats Cards */}
      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="card bg-primary text-white h-100">
            <div className="card-body">
              <h6 className="card-title">Total Projects</h6>
              <h2 className="card-text mb-0">{stats.totalProjects}</h2>
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card bg-warning text-dark h-100">
            <div className="card-body">
              <h6 className="card-title">Pending Projects</h6>
              <h2 className="card-text mb-0">{stats.pendingProjects}</h2>
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card bg-success text-white h-100">
            <div className="card-body">
              <h6 className="card-title">Completed Projects</h6>
              <h2 className="card-text mb-0">{stats.completedProjects}</h2>
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card bg-info text-white h-100">
            <div className="card-body">
              <h6 className="card-title">Total Amount</h6>
              <h2 className="card-text mb-0">Ksh.{stats.totalAmount.toFixed(2)}</h2>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Projects */}
      <div className="card shadow">
        <div className="card-header">
          <h5 className="card-title mb-0">Recent Projects</h5>
        </div>
        <div className="card-body">
          <div className="table-responsive">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Reference</th>
                  <th>Topic</th>
                  <th>Status</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentProjects.map(project => (
                  <tr key={project.id}>
                    <td>{new Date(project.orderDate).toLocaleDateString()}</td>
                    <td>{project.orderRefCode}</td>
                    <td>{project.topic}</td>
                    <td>
                      <span className={`badge bg-${
                        project.status === 'completed' ? 'success' :
                        project.status === 'in-progress' ? 'warning' :
                        project.status === 'cancelled' ? 'danger' : 'secondary'
                      }`}>
                        {project.status}
                      </span>
                    </td>
                    <td>Ksh.{parseFloat(project.amount).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;